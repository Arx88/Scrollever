export interface AIImage {
  id: string
  src: string
  prompt: string
  model: string
  likes: number
  likesNeeded: number
  superlikes: number
  author: string
  category: string
  aspectRatio: "tall" | "wide" | "square"
  createdAt: string
  hoursLeft: number
  isSurvivor: boolean
  isHallOfFame: boolean
  userLiked?: boolean
  userSuperliked?: boolean
  expiresAt?: string
}

export interface ApiImage {
  id: string
  user_id: string
  url: string
  title: string | null
  prompt: string | null
  category: string
  width: number | null
  height: number | null
  like_count: number
  superlike_count: number
  is_immortal: boolean
  is_hall_of_fame: boolean
  created_at: string
  expires_at: string
  author?: string
  profiles?: { username?: string | null } | Array<{ username?: string | null }>
  user_liked?: boolean
  user_superliked?: boolean
}

export const categories = [
  "En llamas",
  "Retratos",
  "Moda",
  "Streetstyle",
  "Collage",
  "Editorial",
  "Productos",
  "Lifestyle",
]

export const aiImages: AIImage[] = []

function resolveAspectRatio(_width: number | null, _height: number | null): "tall" | "wide" | "square" {
  // All images are displayed in 9:16 portrait format
  return "tall"
}

function resolveAuthor(image: ApiImage): string {
  if (typeof image.author === "string" && image.author.length > 0) {
    return image.author
  }

  const profileValue = image.profiles
  if (Array.isArray(profileValue)) {
    return profileValue[0]?.username ?? "anon"
  }

  return profileValue?.username ?? "anon"
}

export function mapApiImageToAIImage(image: ApiImage, nowMs = Date.now()): AIImage {
  const expiresAtMs = image.expires_at ? new Date(image.expires_at).getTime() : nowMs
  const hoursLeft = image.is_immortal
    ? 0
    : Math.max(0, Math.ceil((expiresAtMs - nowMs) / (1000 * 60 * 60)))

  return {
    id: image.id,
    src: image.url,
    prompt: image.prompt ?? image.title ?? "",
    model: "Scrollever",
    likes: image.like_count,
    likesNeeded: 5000,
    superlikes: image.superlike_count,
    author: resolveAuthor(image),
    category: image.category,
    aspectRatio: resolveAspectRatio(image.width, image.height),
    createdAt: image.created_at,
    hoursLeft,
    isSurvivor: image.is_immortal,
    isHallOfFame: image.is_hall_of_fame,
    userLiked: Boolean(image.user_liked),
    userSuperliked: Boolean(image.user_superliked),
    expiresAt: image.expires_at,
  }
}
