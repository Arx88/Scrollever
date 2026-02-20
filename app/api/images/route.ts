import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFallbackFeed } from "@/lib/fallback-feed"

type FeedType = "recent" | "immortal" | "hall-of-fame"

const FEED_VALUES = new Set<FeedType>(["recent", "immortal", "hall-of-fame"])
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const SUPABASE_TIMEOUT_MS = 8000
const PROVISIONAL_ASSET_DIR = path.join(process.cwd(), "public", "provisional")
const ALLOWED_PROVISIONAL_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])

export const runtime = "nodejs"

const createImageSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().max(200).optional().nullable(),
  prompt: z.string().trim().max(4000).optional().nullable(),
  category: z.string().trim().max(50).optional(),
  width: z.coerce.number().int().positive().max(10000).optional().nullable(),
  height: z.coerce.number().int().positive().max(10000).optional().nullable(),
})

interface FeedResult {
  items: any[]
  nextCursor: string | null
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? DEFAULT_LIMIT)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT)
}

function normalizeFeed(value: string | null): FeedType | null {
  const feed = (value ?? "recent") as FeedType
  return FEED_VALUES.has(feed) ? feed : null
}

function parseProfileUsername(profileValue: unknown) {
  if (!profileValue) {
    return null
  }

  if (Array.isArray(profileValue)) {
    const first = profileValue[0] as { username?: string } | undefined
    return first?.username ?? null
  }

  return (profileValue as { username?: string }).username ?? null
}

function fallbackResponse(params: {
  feed: FeedType
  category: string | null
  cursor: string | null
  limit: number
  reason: string
}) {
  const fallback = getFallbackFeed({
    feed: params.feed,
    category: params.category,
    cursor: params.cursor,
    limit: params.limit,
  })

  return NextResponse.json({
    items: fallback.items,
    nextCursor: fallback.nextCursor,
    limit: params.limit,
    feed: params.feed,
    degraded: true,
    reason: params.reason,
  })
}

async function provisionalAssetResponse(fileName: string) {
  const safeName = path.basename(fileName).trim()
  if (!safeName) {
    return NextResponse.json({ error: "Unknown provisional asset" }, { status: 404 })
  }

  const extension = path.extname(safeName).toLowerCase()
  if (!ALLOWED_PROVISIONAL_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unknown provisional asset" }, { status: 404 })
  }

  const absolutePath = path.join(PROVISIONAL_ASSET_DIR, safeName)

  try {
    const buffer = await readFile(absolutePath)
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg"

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch {
    return NextResponse.json({ error: "Provisional asset not found" }, { status: 404 })
  }
}

async function loadFeedFromSupabase(params: {
  feed: FeedType
  category: string | null
  cursor: string | null
  limit: number
}): Promise<FeedResult> {
  const supabase = await createClient()
  const { feed, category, cursor, limit } = params

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id ?? null

  let query = supabase
    .from("images")
    .select("id,user_id,url,title,prompt,category,width,height,like_count,superlike_count,is_immortal,is_hall_of_fame,created_at,expires_at,profiles(username)")
    .is("deleted_at", null)
    .limit(limit + 1)

  if (feed === "recent") {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`is_immortal.eq.true,created_at.gte.${cutoff}`)
    query = query.order("created_at", { ascending: false })
  }

  if (feed === "immortal") {
    query = query.eq("is_immortal", true)
    query = query.order("created_at", { ascending: false })
  }

  if (feed === "hall-of-fame") {
    query = query.eq("is_hall_of_fame", true)
    query = query
      .order("superlike_count", { ascending: false })
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
  }

  if (category && category !== "all" && category !== "En llamas") {
    query = query.eq("category", category)
  }

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const imageIds = pageRows.map((row) => row.id)
  let likedSet = new Set<string>()
  let superlikedSet = new Set<string>()

  if (userId && imageIds.length > 0) {
    const [{ data: likes }, { data: superlikes }] = await Promise.all([
      supabase
        .from("likes")
        .select("image_id")
        .eq("user_id", userId)
        .in("image_id", imageIds),
      supabase
        .from("superlikes")
        .select("image_id")
        .eq("user_id", userId)
        .in("image_id", imageIds),
    ])

    likedSet = new Set((likes ?? []).map((item) => item.image_id))
    superlikedSet = new Set((superlikes ?? []).map((item) => item.image_id))
  }

  const items = pageRows.map((row) => ({
    ...row,
    author: parseProfileUsername(row.profiles) ?? "anon",
    user_liked: likedSet.has(row.id),
    user_superliked: superlikedSet.has(row.id),
  }))

  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null

  return {
    items,
    nextCursor,
  }
}

export async function GET(request: NextRequest) {
  const provisionalAsset = request.nextUrl.searchParams.get("provisional_asset")
  if (provisionalAsset) {
    return provisionalAssetResponse(provisionalAsset)
  }

  const feed = normalizeFeed(request.nextUrl.searchParams.get("feed"))
  if (!feed) {
    return NextResponse.json({ error: "Invalid feed parameter" }, { status: 400 })
  }

  const category = request.nextUrl.searchParams.get("category")
  const cursor = request.nextUrl.searchParams.get("cursor")
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

  if (!isSupabaseConfigured()) {
    return fallbackResponse({
      feed,
      category,
      cursor,
      limit,
      reason: "supabase_not_configured",
    })
  }

  const timeoutToken = Symbol("supabase_timeout")

  try {
    const result = await Promise.race<FeedResult | typeof timeoutToken>([
      loadFeedFromSupabase({ feed, category, cursor, limit }),
      new Promise<typeof timeoutToken>((resolve) => {
        setTimeout(() => resolve(timeoutToken), SUPABASE_TIMEOUT_MS)
      }),
    ])

    if (result === timeoutToken) {
      return fallbackResponse({
        feed,
        category,
        cursor,
        limit,
        reason: "supabase_timeout",
      })
    }

    if (!cursor && result.items.length === 0) {
      return fallbackResponse({
        feed,
        category,
        cursor,
        limit,
        reason: "supabase_empty_feed",
      })
    }

    return NextResponse.json({
      items: result.items,
      nextCursor: result.nextCursor,
      limit,
      feed,
    })
  } catch (error) {
    console.error("[api/images] unhandled_error", error)

    return fallbackResponse({
      feed,
      category,
      cursor,
      limit,
      reason: "supabase_error",
    })
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rawBody = await request.json()
    const parsed = createImageSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const url = new URL(payload.url)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 })
    }

    const imageInsert = {
      user_id: authData.user.id,
      url: payload.url,
      title: payload.title ?? null,
      prompt: payload.prompt ?? null,
      category: payload.category ?? "all",
      width: payload.width ?? null,
      height: payload.height ?? null,
    }

    const { data, error } = await supabase
      .from("images")
      .insert(imageInsert)
      .select("id,user_id,url,title,prompt,category,width,height,like_count,superlike_count,is_immortal,is_hall_of_fame,created_at,expires_at")
      .single()

    if (error) {
      console.error("[api/images] create_error", error)
      return NextResponse.json({ error: "Failed to create image" }, { status: 500 })
    }

    console.info("[api/images] created", {
      userId: authData.user.id,
      imageId: data.id,
      category: data.category,
    })

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (error) {
    console.error("[api/images] create_unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
