import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_FETCH_LIMIT = 20
const MAX_FETCH_LIMIT = 50

const markSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_read"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("mark_all_read"),
  }),
])

function parseLimit(value: string | null) {
  const parsed = Number(value ?? DEFAULT_FETCH_LIMIT)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FETCH_LIMIT
  }

  return Math.min(MAX_FETCH_LIMIT, Math.floor(parsed))
}

function isIsoTimestamp(value: string | null) {
  if (!value) {
    return false
  }

  const date = Date.parse(value)
  return Number.isFinite(date)
}

async function getUnreadCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)

  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      return 0
    }
    return 0
  }

  return count ?? 0
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = authData.user.id
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
  const cursor = request.nextUrl.searchParams.get("cursor")
  const hasCursor = isIsoTimestamp(cursor)

  let query = supabase
    .from("user_notifications")
    .select(
      "id,kind,title,body,cta_path,is_read,created_at,read_at,payload,source_image_id,source_board_id,source_job_id"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (hasCursor && cursor) {
    query = query.lt("created_at", cursor)
  }

  const [rowsRes, unreadCount] = await Promise.all([query, getUnreadCount(supabase, userId)])

  if (rowsRes.error) {
    if ((rowsRes.error as { code?: string }).code === "42P01") {
      return NextResponse.json({
        items: [],
        unreadCount: 0,
        nextCursor: null,
      })
    }
    console.error("[notifications] list_error", rowsRes.error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }

  const items = (rowsRes.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    ctaPath: row.cta_path,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
    payload: row.payload ?? {},
    sourceImageId: row.source_image_id,
    sourceBoardId: row.source_board_id,
    sourceJobId: row.source_job_id,
  }))

  const last = items[items.length - 1]
  return NextResponse.json({
    items,
    unreadCount,
    nextCursor: items.length === limit ? last?.createdAt ?? null : null,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = markSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const userId = authData.user.id
  const nowIso = new Date().toISOString()

  if (parsed.data.action === "mark_read") {
    const { error } = await supabase
      .from("user_notifications")
      .update({
        is_read: true,
        read_at: nowIso,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", userId)
      .eq("is_read", false)

    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        return NextResponse.json({
          ok: true,
          unreadCount: 0,
        })
      }
      console.error("[notifications] mark_read_error", error)
      return NextResponse.json({ error: "Failed to mark notification" }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from("user_notifications")
      .update({
        is_read: true,
        read_at: nowIso,
      })
      .eq("user_id", userId)
      .eq("is_read", false)

    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        return NextResponse.json({
          ok: true,
          unreadCount: 0,
        })
      }
      console.error("[notifications] mark_all_error", error)
      return NextResponse.json({ error: "Failed to mark notifications" }, { status: 500 })
    }
  }

  const unreadCount = await getUnreadCount(supabase, userId)

  return NextResponse.json({
    ok: true,
    unreadCount,
  })
}
