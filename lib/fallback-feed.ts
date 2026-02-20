import type { ApiImage } from "@/lib/image-data"

type FeedType = "recent" | "immortal" | "hall-of-fame"

interface FallbackTemplate {
  id: string
  title: string
  prompt: string
  url: string
  category: string
  width: number
  height: number
  like_count: number
  superlike_count: number
  is_immortal: boolean
  is_hall_of_fame: boolean
  hours_ago: number
  author: string
}

interface FallbackFeedParams {
  feed: FeedType
  category: string | null
  cursor: string | null
  limit: number
}

interface FallbackFeedResult {
  items: ApiImage[]
  nextCursor: string | null
}

function provisionalImageUrl(fileName: string) {
  return `/api/images?provisional_asset=${encodeURIComponent(fileName)}`
}

const templates: FallbackTemplate[] = [
  {
    id: "fallback-1",
    title: "Imagen Provisoria 2",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 2.png",
    url: provisionalImageUrl("Imagen 2.png"),
    category: "Streetstyle",
    width: 900,
    height: 1200,
    like_count: 842,
    superlike_count: 34,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 2,
    author: "fallback.street",
  },
  {
    id: "fallback-2",
    title: "Imagen Provisoria 4",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 4.png",
    url: provisionalImageUrl("Imagen 4.png"),
    category: "Editorial",
    width: 900,
    height: 1200,
    like_count: 1901,
    superlike_count: 121,
    is_immortal: true,
    is_hall_of_fame: true,
    hours_ago: 80,
    author: "fallback.editorial",
  },
  {
    id: "fallback-3",
    title: "Imagen Provisoria 7",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 7.png",
    url: provisionalImageUrl("Imagen 7.png"),
    category: "Moda",
    width: 900,
    height: 1200,
    like_count: 488,
    superlike_count: 17,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 7,
    author: "fallback.moda",
  },
  {
    id: "fallback-4",
    title: "Imagen Provisoria 9",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 9.png",
    url: provisionalImageUrl("Imagen 9.png"),
    category: "Productos",
    width: 1200,
    height: 800,
    like_count: 365,
    superlike_count: 9,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 5,
    author: "fallback.product",
  },
  {
    id: "fallback-5",
    title: "Imagen Provisoria 10",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 10.png",
    url: provisionalImageUrl("Imagen 10.png"),
    category: "Lifestyle",
    width: 900,
    height: 1200,
    like_count: 731,
    superlike_count: 41,
    is_immortal: true,
    is_hall_of_fame: false,
    hours_ago: 52,
    author: "fallback.life",
  },
  {
    id: "fallback-6",
    title: "Imagen Provisoria 13",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 13.png",
    url: provisionalImageUrl("Imagen 13.png"),
    category: "Collage",
    width: 1000,
    height: 1000,
    like_count: 429,
    superlike_count: 22,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 3,
    author: "fallback.collage",
  },
  {
    id: "fallback-7",
    title: "Imagen Provisoria 14",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 14.png",
    url: provisionalImageUrl("Imagen 14.png"),
    category: "Retratos",
    width: 900,
    height: 1200,
    like_count: 612,
    superlike_count: 26,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 6,
    author: "fallback.retratos",
  },
  {
    id: "fallback-8",
    title: "Imagen Provisoria 15",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 15.png",
    url: provisionalImageUrl("Imagen 15.png"),
    category: "Streetstyle",
    width: 900,
    height: 1200,
    like_count: 715,
    superlike_count: 48,
    is_immortal: true,
    is_hall_of_fame: false,
    hours_ago: 30,
    author: "fallback.street.2",
  },
  {
    id: "fallback-9",
    title: "Imagen Provisoria 17",
    prompt: "Asset local provisional cargado desde Everscroll/Imagen 17.png",
    url: provisionalImageUrl("Imagen 17.png"),
    category: "Editorial",
    width: 900,
    height: 1200,
    like_count: 2240,
    superlike_count: 153,
    is_immortal: true,
    is_hall_of_fame: true,
    hours_ago: 90,
    author: "fallback.editorial.2",
  },
]

function materializeRows(nowMs: number): ApiImage[] {
  return templates.map((template) => {
    const createdAtMs = nowMs - template.hours_ago * 60 * 60 * 1000
    const expiresAtMs = createdAtMs + 24 * 60 * 60 * 1000

    return {
      id: template.id,
      user_id: "00000000-0000-0000-0000-000000000000",
      url: template.url,
      title: template.title,
      prompt: template.prompt,
      category: template.category,
      width: template.width,
      height: template.height,
      like_count: template.like_count,
      superlike_count: template.superlike_count,
      is_immortal: template.is_immortal,
      is_hall_of_fame: template.is_hall_of_fame,
      created_at: new Date(createdAtMs).toISOString(),
      expires_at: new Date(expiresAtMs).toISOString(),
      author: template.author,
      user_liked: false,
      user_superliked: false,
    }
  })
}

export function getFallbackFeed({ feed, category, cursor, limit }: FallbackFeedParams): FallbackFeedResult {
  const nowMs = Date.now()
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000
  const normalizedCategory = category && category !== "all" && category !== "En llamas" ? category : null

  let rows = materializeRows(nowMs)

  if (feed === "recent") {
    rows = rows.filter((row) => row.is_immortal || new Date(row.created_at).getTime() >= cutoffMs)
    rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  if (feed === "immortal") {
    rows = rows.filter((row) => row.is_immortal)
    rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  if (feed === "hall-of-fame") {
    rows = rows.filter((row) => row.is_hall_of_fame)
    rows = rows.sort((a, b) => {
      if (b.superlike_count !== a.superlike_count) {
        return b.superlike_count - a.superlike_count
      }
      if (b.like_count !== a.like_count) {
        return b.like_count - a.like_count
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  if (normalizedCategory) {
    rows = rows.filter((row) => row.category === normalizedCategory)
  }

  if (cursor) {
    rows = rows.filter((row) => new Date(row.created_at).getTime() < new Date(cursor).getTime())
  }

  const pageRows = rows.slice(0, limit + 1)
  const hasMore = pageRows.length > limit
  const items = hasMore ? pageRows.slice(0, limit) : pageRows
  const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null

  return { items, nextCursor }
}
