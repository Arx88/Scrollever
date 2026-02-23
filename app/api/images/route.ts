import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getFallbackFeed } from "@/lib/fallback-feed"
import { getDefaultSettingValue } from "@/lib/admin/config-catalog"
import { trackProductEvent } from "@/lib/analytics/track-event"
import type { SupabaseClient } from "@supabase/supabase-js"

type FeedType = "recent" | "immortal" | "hall-of-fame"
type FeedSort = "position" | "newest"

const FEED_VALUES = new Set<FeedType>(["recent", "immortal", "hall-of-fame"])
const SORT_VALUES = new Set<FeedSort>(["position", "newest"])
const ABSOLUTE_MAX_LIMIT = 200
const SUPABASE_TIMEOUT_MS = 8000
const PROVISIONAL_ASSET_DIR = path.join(process.cwd(), "public", "provisional")
const ALLOWED_PROVISIONAL_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const IMAGE_SELECT_COLUMNS =
  "id,user_id,url,title,prompt,category,width,height,like_count,superlike_count,is_immortal,is_hall_of_fame,created_at,expires_at,profiles(username)"
const DEFAULT_LIMIT = getDefaultNumberSetting("feed.limit_default", 20)
const MAX_LIMIT = getDefaultNumberSetting("feed.limit_max", 50)
const DEFAULT_SURVIVAL_LIKES_NEEDED = getDefaultNumberSetting("survival.likes_needed_default", 5000)

export const runtime = "nodejs"

function getDefaultNumberSetting(key: string, fallback: number) {
  const value = getDefaultSettingValue(key)
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

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
  limit: number
}

interface RankingRow {
  id: string
  cohort_date: string
  rank_in_cohort: number
  cohort_size: number
  cutoff_position: number
  likes_needed: number
  will_survive: boolean
}

interface HallOfFameRankingRow {
  image_id: string
  rank_position: number
  hof_score: number
}

interface RuntimeFeedSettings {
  limitDefault: number
  limitMax: number
  survivalLikesNeededDefault: number
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function parseRequestedLimit(value: string | null) {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(Math.floor(parsed), ABSOLUTE_MAX_LIMIT)
}

function normalizeFeed(value: string | null): FeedType | null {
  const feed = (value ?? "recent") as FeedType
  return FEED_VALUES.has(feed) ? feed : null
}

function normalizeSort(value: string | null): FeedSort {
  const sort = (value ?? "position") as FeedSort
  return SORT_VALUES.has(sort) ? sort : "position"
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

function normalizeCategory(category: string | null) {
  if (!category || category === "all" || category === "En llamas") {
    return null
  }

  return category
}

function getImageVisualKey(row: { id?: string | null; url?: string | null }) {
  const normalizedUrl = typeof row.url === "string" ? row.url.trim().toLowerCase() : ""
  if (normalizedUrl.length > 0) {
    return `url:${normalizedUrl}`
  }
  return `id:${row.id ?? "unknown"}`
}

function dedupeImageRowsByVisual<T extends { id?: string | null; url?: string | null }>(
  rows: T[],
  seenKeys: Set<string> = new Set<string>()
) {
  const deduped: T[] = []
  for (const row of rows) {
    const key = getImageVisualKey(row)
    if (seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)
    deduped.push(row)
  }
  return deduped
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function parseSettingNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

async function loadRuntimeFeedSettings(supabase: SupabaseClient): Promise<RuntimeFeedSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("key,value_json")
    .in("key", ["feed.limit_default", "feed.limit_max", "survival.likes_needed_default"])

  const rows = data ?? []
  const keyMap = new Map(rows.map((row) => [row.key, row.value_json]))

  const configuredMax = parseSettingNumber(keyMap.get("feed.limit_max"), MAX_LIMIT)
  const limitMax = clampInt(configuredMax, 1, ABSOLUTE_MAX_LIMIT)

  const configuredDefault = parseSettingNumber(keyMap.get("feed.limit_default"), DEFAULT_LIMIT)
  const limitDefault = clampInt(configuredDefault, 1, limitMax)

  const configuredLikesNeeded = parseSettingNumber(
    keyMap.get("survival.likes_needed_default"),
    DEFAULT_SURVIVAL_LIKES_NEEDED
  )

  return {
    limitDefault,
    limitMax,
    survivalLikesNeededDefault: clampInt(configuredLikesNeeded, 1, 1_000_000),
  }
}

function resolveFeedLimit(requestedLimit: number | null, runtime: RuntimeFeedSettings) {
  const source = requestedLimit ?? runtime.limitDefault
  return clampInt(source, 1, runtime.limitMax)
}

async function loadUserInteractions(
  supabase: SupabaseClient,
  userId: string | null,
  imageIds: string[]
) {
  if (!userId || imageIds.length === 0) {
    return {
      likedSet: new Set<string>(),
      superlikedSet: new Set<string>(),
    }
  }

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

  return {
    likedSet: new Set((likes ?? []).map((item) => item.image_id)),
    superlikedSet: new Set((superlikes ?? []).map((item) => item.image_id)),
  }
}

async function loadLegacyHallOfFameFeed(params: {
  supabase: SupabaseClient
  userId: string | null
  category: string | null
  cursor: string | null
  limit: number
  survivalLikesNeededDefault: number
}): Promise<FeedResult> {
  const { supabase, userId, category, cursor, limit, survivalLikesNeededDefault } = params

  let query = supabase
    .from("images")
    .select(IMAGE_SELECT_COLUMNS)
    .is("deleted_at", null)
    .eq("is_hall_of_fame", true)
    .order("superlike_count", { ascending: false })
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  const normalizedCategory = normalizeCategory(category)
  if (normalizedCategory) {
    query = query.eq("category", normalizedCategory)
  }

  if (cursor) {
    const cursorDateMs = Date.parse(cursor)
    if (Number.isFinite(cursorDateMs)) {
      query = query.lt("created_at", cursor)
    }
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const imageIds = pageRows.map((row) => row.id)
  const { likedSet, superlikedSet } = await loadUserInteractions(supabase, userId, imageIds)

  const items = pageRows.map((row) => ({
    ...row,
    rank_today: null,
    cutoff_position: null,
    cohort_size: null,
    will_survive: null,
    cohort_date: null,
    likes_needed: survivalLikesNeededDefault,
    author: parseProfileUsername(row.profiles) ?? "anon",
    user_liked: likedSet.has(row.id),
    user_superliked: superlikedSet.has(row.id),
  }))

  return {
    items,
    nextCursor: hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null,
    limit,
  }
}

async function loadHallOfFameFeed(params: {
  supabase: SupabaseClient
  userId: string | null
  category: string | null
  cursor: string | null
  limit: number
  survivalLikesNeededDefault: number
}): Promise<FeedResult> {
  const { supabase, userId, category, cursor, limit, survivalLikesNeededDefault } = params
  const normalizedCategory = normalizeCategory(category)
  const cursorRank = cursor ? Number(cursor) : 0
  const rankThreshold = Number.isFinite(cursorRank) && cursorRank > 0 ? Math.floor(cursorRank) : 0

  const { data: rankingRows, error: rankingError } = await supabase.rpc("get_hall_of_fame_ranking", {
    p_limit: 500,
  })

  if (rankingError) {
    console.error("[api/images] hof_ranking_error", rankingError)
    return loadLegacyHallOfFameFeed({
      supabase,
      userId,
      category,
      cursor,
      limit,
      survivalLikesNeededDefault,
    })
  }

  const ranked = (rankingRows ?? []) as HallOfFameRankingRow[]
  if (ranked.length === 0) {
    return loadLegacyHallOfFameFeed({
      supabase,
      userId,
      category,
      cursor,
      limit,
      survivalLikesNeededDefault,
    })
  }

  const eligibleRanks = ranked.filter((row) => row.rank_position > rankThreshold)

  if (eligibleRanks.length === 0) {
    return {
      items: [],
      nextCursor: null,
      limit,
    }
  }

  const idsForLookup = eligibleRanks.map((row) => row.image_id)
  const { data: imageRows, error: imagesError } = await supabase
    .from("images")
    .select(IMAGE_SELECT_COLUMNS)
    .is("deleted_at", null)
    .in("id", idsForLookup)

  if (imagesError) {
    console.error("[api/images] hof_images_error", imagesError)
    return loadLegacyHallOfFameFeed({
      supabase,
      userId,
      category,
      cursor,
      limit,
      survivalLikesNeededDefault,
    })
  }

  const imageById = new Map((imageRows ?? []).map((row) => [row.id, row]))
  const orderedRows: Array<any> = []

  for (const ranking of eligibleRanks) {
    const image = imageById.get(ranking.image_id)
    if (!image) {
      continue
    }

    if (normalizedCategory && image.category !== normalizedCategory) {
      continue
    }

    orderedRows.push({
      ...image,
      hof_rank_position: ranking.rank_position,
      hof_score: ranking.hof_score,
    })

    if (orderedRows.length > limit) {
      break
    }
  }

  const hasMore = orderedRows.length > limit
  const pageRows = hasMore ? orderedRows.slice(0, limit) : orderedRows
  const imageIds = pageRows.map((row) => row.id)
  const { likedSet, superlikedSet } = await loadUserInteractions(supabase, userId, imageIds)

  const items = pageRows.map((row) => ({
    ...row,
    rank_today: null,
    cutoff_position: null,
    cohort_size: null,
    will_survive: null,
    cohort_date: null,
    likes_needed: survivalLikesNeededDefault,
    author: parseProfileUsername(row.profiles) ?? "anon",
    user_liked: likedSet.has(row.id),
    user_superliked: superlikedSet.has(row.id),
  }))

  const nextCursor = hasMore ? String(pageRows[pageRows.length - 1]?.hof_rank_position ?? "") : null

  return {
    items,
    nextCursor: nextCursor || null,
    limit,
  }
}

async function loadRecentByPositionFeed(params: {
  supabase: SupabaseClient
  userId: string | null
  category: string | null
  cursor: string | null
  limit: number
  survivalLikesNeededDefault: number
}): Promise<FeedResult> {
  const { supabase, userId, category, cursor, limit, survivalLikesNeededDefault } = params
  const normalizedCategory = normalizeCategory(category)
  const offset = cursor ? Number(cursor) : 0
  const startIndex = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0

  const { data: rankingData, error: rankingError } = await supabase.rpc("get_live_ranking")

  if (rankingError) {
    console.error("[api/images] ranking_error", rankingError)
    throw rankingError
  }

  const rankingRows = (rankingData ?? []) as RankingRow[]
  const rankedIds = rankingRows.map((row) => row.id)

  const rankedImageRows =
    rankedIds.length === 0
      ? []
      : (
          await supabase
            .from("images")
            .select(IMAGE_SELECT_COLUMNS)
            .is("deleted_at", null)
            .eq("is_immortal", false)
            .in("id", rankedIds)
            .then(({ data, error }) => {
              if (error) {
                throw error
              }

              return data ?? []
            })
        )

  const rankedImageMap = new Map(rankedImageRows.map((row) => [row.id, row]))
  const rankedItemsRaw = rankingRows
    .map((ranking) => {
      const row = rankedImageMap.get(ranking.id)
      if (!row) {
        return null
      }

      if (normalizedCategory && row.category !== normalizedCategory) {
        return null
      }

      return {
        ...row,
        rank_today: ranking.rank_in_cohort,
        cutoff_position: ranking.cutoff_position,
        cohort_size: ranking.cohort_size,
        will_survive: ranking.will_survive,
        cohort_date: ranking.cohort_date,
        likes_needed: ranking.likes_needed ?? survivalLikesNeededDefault,
      }
    })
    .filter(Boolean) as Array<any>

  rankedItemsRaw.sort((a, b) => {
    if ((a.rank_today ?? Number.MAX_SAFE_INTEGER) !== (b.rank_today ?? Number.MAX_SAFE_INTEGER)) {
      return (a.rank_today ?? Number.MAX_SAFE_INTEGER) - (b.rank_today ?? Number.MAX_SAFE_INTEGER)
    }
    if ((b.like_count ?? 0) !== (a.like_count ?? 0)) {
      return (b.like_count ?? 0) - (a.like_count ?? 0)
    }
    if ((b.superlike_count ?? 0) !== (a.superlike_count ?? 0)) {
      return (b.superlike_count ?? 0) - (a.superlike_count ?? 0)
    }

    const aCreated = Date.parse(a.created_at)
    const bCreated = Date.parse(b.created_at)
    if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
      return bCreated - aCreated
    }

    return String(a.id).localeCompare(String(b.id))
  })

  const globalCutoff = Math.max(
    1,
    rankedItemsRaw.reduce((count, row) => count + (row.will_survive ? 1 : 0), 0)
  )

  const rankedItems = rankedItemsRaw.map((row, index) => {
    const globalRank = index + 1
    return {
      ...row,
      rank_today: globalRank,
      cutoff_position: globalCutoff,
      will_survive: globalRank <= globalCutoff,
    }
  })

  const seenVisualKeys = new Set<string>()
  const uniqueRankedItems = dedupeImageRowsByVisual(rankedItems, seenVisualKeys)

  let immortalsQuery = supabase
    .from("images")
    .select(IMAGE_SELECT_COLUMNS)
    .is("deleted_at", null)
    .eq("is_immortal", true)
    .order("created_at", { ascending: false })

  if (normalizedCategory) {
    immortalsQuery = immortalsQuery.eq("category", normalizedCategory)
  }

  const { data: immortalRows, error: immortalError } = await immortalsQuery
  if (immortalError) {
    throw immortalError
  }

  const immortalItems = (immortalRows ?? []).map((row) => ({
    ...row,
    rank_today: null,
    cutoff_position: null,
    cohort_size: null,
    will_survive: null,
    cohort_date: null,
    likes_needed: survivalLikesNeededDefault,
  }))

  const uniqueImmortalItems = dedupeImageRowsByVisual(immortalItems, seenVisualKeys)
  const merged = [...uniqueRankedItems, ...uniqueImmortalItems]
  const page = merged.slice(startIndex, startIndex + limit + 1)
  const hasMore = page.length > limit
  const pageRows = hasMore ? page.slice(0, limit) : page

  const imageIds = pageRows.map((row) => row.id)
  const { likedSet, superlikedSet } = await loadUserInteractions(supabase, userId, imageIds)

  const items = pageRows.map((row) => ({
    ...row,
    author: parseProfileUsername(row.profiles) ?? "anon",
    user_liked: likedSet.has(row.id),
    user_superliked: superlikedSet.has(row.id),
  }))

  return {
    items,
    nextCursor: hasMore ? String(startIndex + limit) : null,
    limit,
  }
}

function fallbackResponse(params: {
  feed: FeedType
  sort: FeedSort
  category: string | null
  cursor: string | null
  limit: number
  reason: string
}) {
  const fallback = getFallbackFeed({
    feed: params.feed,
    sort: params.sort,
    category: params.category,
    cursor: params.cursor,
    limit: params.limit,
  })

  return NextResponse.json({
    items: fallback.items,
    nextCursor: fallback.nextCursor,
    limit: params.limit,
    feed: params.feed,
    sort: params.sort,
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
  sort: FeedSort
  category: string | null
  cursor: string | null
  requestedLimit: number | null
}): Promise<FeedResult> {
  const supabase = await createClient()
  const { feed, sort, category, cursor, requestedLimit } = params

  const [{ data: authData }, runtimeSettings] = await Promise.all([
    supabase.auth.getUser(),
    loadRuntimeFeedSettings(supabase),
  ])
  const userId = authData.user?.id ?? null
  const limit = resolveFeedLimit(requestedLimit, runtimeSettings)
  const normalizedCategory = normalizeCategory(category)

  if (feed === "hall-of-fame") {
    return loadHallOfFameFeed({
      supabase,
      userId,
      category: normalizedCategory,
      cursor,
      limit,
      survivalLikesNeededDefault: runtimeSettings.survivalLikesNeededDefault,
    })
  }

  if (feed === "recent" && sort === "position") {
    return loadRecentByPositionFeed({
      supabase,
      userId,
      category: normalizedCategory,
      cursor,
      limit,
      survivalLikesNeededDefault: runtimeSettings.survivalLikesNeededDefault,
    })
  }

  const targetRows = limit + 1
  const chunkLimit = Math.min(ABSOLUTE_MAX_LIMIT, Math.max(targetRows * 3, 40))
  const seenVisualKeys = new Set<string>()
  const rows: any[] = []
  let queryCursor: string | null = cursor
  let iteration = 0

  while (rows.length < targetRows && iteration < 8) {
    iteration += 1

    let query = supabase
      .from("images")
      .select(IMAGE_SELECT_COLUMNS)
      .is("deleted_at", null)
      .limit(chunkLimit)

    if (feed === "recent") {
      const nowIso = new Date().toISOString()
      query = query.or(`is_immortal.eq.true,expires_at.gt.${nowIso}`)
      query = query.order("created_at", { ascending: false })
    }

    if (feed === "immortal") {
      query = query.eq("is_immortal", true)
      query = query.order("created_at", { ascending: false })
    }

    if (normalizedCategory) {
      query = query.eq("category", normalizedCategory)
    }

    if (queryCursor) {
      const cursorDateMs = Date.parse(queryCursor)
      if (Number.isFinite(cursorDateMs)) {
        query = query.lt("created_at", queryCursor)
      }
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const batch = data ?? []
    if (batch.length === 0) {
      break
    }

    const dedupedBatch = dedupeImageRowsByVisual(batch, seenVisualKeys)
    rows.push(...dedupedBatch)

    if (rows.length >= targetRows) {
      break
    }

    if (batch.length < chunkLimit) {
      break
    }

    const nextBatchCursor = batch[batch.length - 1]?.created_at ?? null
    if (!nextBatchCursor || nextBatchCursor === queryCursor) {
      break
    }
    queryCursor = nextBatchCursor
  }

  if (rows.length > targetRows) {
    rows.length = targetRows
  }

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const imageIds = pageRows.map((row) => row.id)
  const { likedSet, superlikedSet } = await loadUserInteractions(supabase, userId, imageIds)
  let rankingMap = new Map<string, RankingRow>()

  if (feed === "recent" && imageIds.length > 0) {
    const { data: rankingData, error: rankingError } = await supabase.rpc("get_live_ranking")
    if (rankingError) {
      console.error("[api/images] ranking_error", rankingError)
    } else {
      rankingMap = new Map(
        (rankingData ?? []).map((row: RankingRow) => [row.id, row])
      )
    }
  }

  const items = pageRows.map((row) => ({
    ...(rankingMap.has(row.id)
      ? {
          rank_today: rankingMap.get(row.id)?.rank_in_cohort ?? null,
          cutoff_position: rankingMap.get(row.id)?.cutoff_position ?? null,
          cohort_size: rankingMap.get(row.id)?.cohort_size ?? null,
          will_survive: rankingMap.get(row.id)?.will_survive ?? null,
          cohort_date: rankingMap.get(row.id)?.cohort_date ?? null,
          likes_needed:
            rankingMap.get(row.id)?.likes_needed ?? runtimeSettings.survivalLikesNeededDefault,
        }
      : {
          rank_today: null,
          cutoff_position: null,
          cohort_size: null,
          will_survive: null,
          cohort_date: null,
          likes_needed: runtimeSettings.survivalLikesNeededDefault,
        }),
    ...row,
    author: parseProfileUsername(row.profiles) ?? "anon",
    user_liked: likedSet.has(row.id),
    user_superliked: superlikedSet.has(row.id),
  }))

  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null

  return {
    items,
    nextCursor,
    limit,
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
  const sort = normalizeSort(request.nextUrl.searchParams.get("sort"))

  const category = request.nextUrl.searchParams.get("category")
  const cursor = request.nextUrl.searchParams.get("cursor")
  const requestedLimit = parseRequestedLimit(request.nextUrl.searchParams.get("limit"))
  const fallbackLimit = requestedLimit ?? DEFAULT_LIMIT

  if (!isSupabaseConfigured()) {
    return fallbackResponse({
      feed,
      sort,
      category,
      cursor,
      limit: fallbackLimit,
      reason: "supabase_not_configured",
    })
  }

  const timeoutToken = Symbol("supabase_timeout")

  try {
    const result = await Promise.race<FeedResult | typeof timeoutToken>([
      loadFeedFromSupabase({ feed, sort, category, cursor, requestedLimit }),
      new Promise<typeof timeoutToken>((resolve) => {
        setTimeout(() => resolve(timeoutToken), SUPABASE_TIMEOUT_MS)
      }),
    ])

    if (result === timeoutToken) {
      return fallbackResponse({
        feed,
        sort,
        category,
        cursor,
        limit: fallbackLimit,
        reason: "supabase_timeout",
      })
    }

    if (!cursor && result.items.length === 0) {
      return fallbackResponse({
        feed,
        sort,
        category,
        cursor,
        limit: fallbackLimit,
        reason: "supabase_empty_feed",
      })
    }

    return NextResponse.json({
      items: result.items,
      nextCursor: result.nextCursor,
      limit: result.limit,
      feed,
      sort,
    })
  } catch (error) {
    console.error("[api/images] unhandled_error", error)

    return fallbackResponse({
      feed,
      sort,
      category,
      cursor,
      limit: fallbackLimit,
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

    void trackProductEvent({
      supabase,
      request,
      eventName: "image_published",
      userId: authData.user.id,
      source: "feed",
      path: request.nextUrl.pathname,
      metadata: {
        imageId: data.id,
        originType: "uploaded",
        category: data.category,
      },
    })

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (error) {
    console.error("[api/images] create_unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
