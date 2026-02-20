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
  return `/provisional/${encodeURIComponent(fileName)}`
}

const templates: FallbackTemplate[] = [
  {
    id: "fallback-1",
    title: "Neon Streetwear Tokyo",
    prompt: "Fashion editorial photography, woman in avant-garde streetwear, neon-lit Tokyo alley at night, cyberpunk aesthetic, cinematic lighting, dramatic shadows",
    url: provisionalImageUrl("Imagen 2.png"),
    category: "Streetstyle",
    width: 900,
    height: 1600,
    like_count: 842,
    superlike_count: 34,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 2,
    author: "neo.street",
  },
  {
    id: "fallback-2",
    title: "Flora Portrait Surreal",
    prompt: "Surreal portrait of a person with flowers growing from their head, dark moody background, fine art photography style, vibrant colors against dark tones",
    url: provisionalImageUrl("Imagen 4.png"),
    category: "Editorial",
    width: 900,
    height: 1600,
    like_count: 1901,
    superlike_count: 121,
    is_immortal: true,
    is_hall_of_fame: true,
    hours_ago: 80,
    author: "flora.vision",
  },
  {
    id: "fallback-3",
    title: "Desert Goddess",
    prompt: "High fashion model in flowing white gown, desert landscape at golden hour, dramatic wind effect on fabric, editorial fashion photography, minimalist composition",
    url: provisionalImageUrl("Imagen 7.png"),
    category: "Moda",
    width: 900,
    height: 1600,
    like_count: 488,
    superlike_count: 17,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 7,
    author: "desert.moda",
  },
  {
    id: "fallback-4",
    title: "Lime Luxe Product",
    prompt: "Luxury product photography, perfume bottle on reflective black surface, dramatic studio lighting with lime green accent lights, premium commercial style",
    url: provisionalImageUrl("Imagen 9.png"),
    category: "Productos",
    width: 900,
    height: 1600,
    like_count: 365,
    superlike_count: 9,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 5,
    author: "luxe.studio",
  },
  {
    id: "fallback-5",
    title: "Cafe Film Grain",
    prompt: "Lifestyle photography, young woman reading in a cozy cafe with warm ambient lighting, latte art on table, film grain aesthetic, soft natural light",
    url: provisionalImageUrl("Imagen 10.png"),
    category: "Lifestyle",
    width: 900,
    height: 1600,
    like_count: 731,
    superlike_count: 41,
    is_immortal: true,
    is_hall_of_fame: false,
    hours_ago: 52,
    author: "cafe.life",
  },
  {
    id: "fallback-6",
    title: "Digital Collage Grunge",
    prompt: "Abstract digital collage art, mixed media, torn paper textures, bold typography fragments, grunge aesthetic with neon accents, contemporary art poster style",
    url: provisionalImageUrl("Imagen 13.png"),
    category: "Collage",
    width: 900,
    height: 1600,
    like_count: 429,
    superlike_count: 22,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 3,
    author: "collage.punk",
  },
  {
    id: "fallback-7",
    title: "Metallic Portrait",
    prompt: "Dramatic close-up portrait, person with metallic face paint, studio lighting with dramatic shadows, high contrast with subtle gold accents, fine art portrait",
    url: provisionalImageUrl("Imagen 14.png"),
    category: "Retratos",
    width: 900,
    height: 1600,
    like_count: 612,
    superlike_count: 26,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 6,
    author: "metal.faces",
  },
  {
    id: "fallback-8",
    title: "Urban Skate Raw",
    prompt: "Urban street photography, skateboarder doing trick in abandoned warehouse, dramatic natural light through broken windows, gritty documentary style, motion blur",
    url: provisionalImageUrl("Imagen 15.png"),
    category: "Streetstyle",
    width: 900,
    height: 1600,
    like_count: 715,
    superlike_count: 48,
    is_immortal: true,
    is_hall_of_fame: false,
    hours_ago: 30,
    author: "raw.skate",
  },
  {
    id: "fallback-9",
    title: "Brutalist Red Editorial",
    prompt: "Editorial fashion photography, model in bold red outfit on geometric brutalist architecture background, strong shadows, Vogue magazine style, sharp contrast",
    url: provisionalImageUrl("Imagen 17.png"),
    category: "Editorial",
    width: 900,
    height: 1600,
    like_count: 2240,
    superlike_count: 153,
    is_immortal: true,
    is_hall_of_fame: true,
    hours_ago: 90,
    author: "vogue.brutal",
  },
  {
    id: "fallback-10",
    title: "Gemini Neon Monolith",
    prompt: "Cinematic portrait with neon monoliths, dense atmospheric fog, moody contrast, high detail editorial composition",
    url: provisionalImageUrl("Gemini_Generated_Image_3ts8ny3ts8ny3ts8.png"),
    category: "Editorial",
    width: 900,
    height: 1600,
    like_count: 958,
    superlike_count: 64,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 4,
    author: "gemini.neon",
  },
  {
    id: "fallback-11",
    title: "Gemini Velvet Shadows",
    prompt: "Dark fashion portrait, velvet shadows, dramatic side light, premium campaign aesthetic, rich texture detail",
    url: provisionalImageUrl("Gemini_Generated_Image_6sfjf26sfjf26sfj.png"),
    category: "Moda",
    width: 900,
    height: 1600,
    like_count: 1320,
    superlike_count: 93,
    is_immortal: true,
    is_hall_of_fame: false,
    hours_ago: 29,
    author: "velvet.frame",
  },
  {
    id: "fallback-12",
    title: "Gemini Future Relic",
    prompt: "Futuristic artifact still life, mirrored surfaces, precise studio lighting, premium product storytelling, cinematic polish",
    url: provisionalImageUrl("Gemini_Generated_Image_o044ilo044ilo044.png"),
    category: "Productos",
    width: 900,
    height: 1600,
    like_count: 1765,
    superlike_count: 127,
    is_immortal: true,
    is_hall_of_fame: true,
    hours_ago: 72,
    author: "future.relic",
  },
  {
    id: "fallback-13",
    title: "Gemini Urban Mirage",
    prompt: "Stylized urban portrait, reflective puddles, rain-soaked streets, documentary fashion blend, gritty and elegant",
    url: provisionalImageUrl("Gemini_Generated_Image_ujii97ujii97ujii.png"),
    category: "Streetstyle",
    width: 900,
    height: 1600,
    like_count: 684,
    superlike_count: 37,
    is_immortal: false,
    is_hall_of_fame: false,
    hours_ago: 10,
    author: "urban.mirage",
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
