import { createServiceClient, isServiceClientConfigured } from "@/lib/supabase/service"

export type NotificationKind =
  | "generation_ready"
  | "board_saved"
  | "image_saved_by_other"
  | "like_milestone"
  | "superlike_received"
  | "system_info"

interface CreateUserNotificationInput {
  userId: string
  kind: NotificationKind
  title: string
  body: string
  ctaPath?: string | null
  eventKey?: string | null
  payload?: Record<string, unknown>
  sourceImageId?: string | null
  sourceBoardId?: string | null
  sourceJobId?: string | null
}

interface NotificationRuntimeFlags {
  enabled: boolean
  creatorLoopEnabled: boolean
}

const LIKE_MILESTONES = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]
const RUNTIME_FLAGS_TTL_MS = 30_000

let runtimeFlagsCache:
  | {
      expiresAt: number
      flags: NotificationRuntimeFlags
    }
  | null = null

function sanitizeText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function isDuplicateEventError(error: { code?: string | null; message?: string | null }) {
  return error.code === "23505"
}

async function loadRuntimeFlags(supabase: ReturnType<typeof createServiceClient>) {
  if (runtimeFlagsCache && runtimeFlagsCache.expiresAt > Date.now()) {
    return runtimeFlagsCache.flags
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value_json")
    .in("key", ["notifications.enabled", "notifications.creator_loop_enabled"])

  if (error) {
    console.error("[notifications] settings_read_error", error)
    const fallback = { enabled: true, creatorLoopEnabled: true } satisfies NotificationRuntimeFlags
    runtimeFlagsCache = {
      expiresAt: Date.now() + RUNTIME_FLAGS_TTL_MS,
      flags: fallback,
    }
    return fallback
  }

  const map = new Map((data ?? []).map((row) => [row.key, row.value_json]))
  const enabled = map.get("notifications.enabled")
  const creatorLoopEnabled = map.get("notifications.creator_loop_enabled")

  const flags = {
    enabled: typeof enabled === "boolean" ? enabled : true,
    creatorLoopEnabled: typeof creatorLoopEnabled === "boolean" ? creatorLoopEnabled : true,
  } satisfies NotificationRuntimeFlags

  runtimeFlagsCache = {
    expiresAt: Date.now() + RUNTIME_FLAGS_TTL_MS,
    flags,
  }

  return flags
}

export function resolveLikeMilestone(likeCount: number) {
  if (!Number.isFinite(likeCount) || likeCount <= 0) {
    return null
  }

  const normalized = Math.floor(likeCount)
  return LIKE_MILESTONES.includes(normalized) ? normalized : null
}

export async function enqueueUserNotification(input: CreateUserNotificationInput) {
  if (!isServiceClientConfigured()) {
    return false
  }

  const supabase = createServiceClient()
  const flags = await loadRuntimeFlags(supabase)
  if (!flags.enabled) {
    return false
  }

  if (input.kind !== "system_info" && !flags.creatorLoopEnabled) {
    return false
  }

  const row = {
    user_id: input.userId,
    kind: input.kind,
    title: sanitizeText(input.title, 120),
    body: sanitizeText(input.body, 420),
    cta_path: input.ctaPath?.trim() || null,
    event_key: input.eventKey?.trim() || null,
    payload: input.payload ?? {},
    source_image_id: input.sourceImageId ?? null,
    source_board_id: input.sourceBoardId ?? null,
    source_job_id: input.sourceJobId ?? null,
  }

  const { error } = await supabase.from("user_notifications").insert(row)

  if (error) {
    if (isDuplicateEventError(error)) {
      return false
    }

    console.error("[notifications] enqueue_error", {
      error,
      userId: input.userId,
      kind: input.kind,
      eventKey: input.eventKey,
    })
    return false
  }

  return true
}

export async function notifyGenerationReady(input: {
  userId: string
  imageId: string
  jobId: string
  prompt: string
}) {
  const shortPrompt = sanitizeText(input.prompt, 90)
  return enqueueUserNotification({
    userId: input.userId,
    kind: "generation_ready",
    title: "Tu imagen ya esta lista",
    body: shortPrompt.length > 0 ? `"${shortPrompt}" se publico en tu feed.` : "Tu nueva imagen se publico en tu feed.",
    ctaPath: "/create",
    eventKey: `generation_ready:${input.jobId}`,
    sourceImageId: input.imageId,
    sourceJobId: input.jobId,
    payload: {
      jobId: input.jobId,
      imageId: input.imageId,
    },
  })
}

export async function notifyBoardSave(input: {
  userId: string
  imageId: string
  boardId: string
  boardTitle: string
}) {
  return enqueueUserNotification({
    userId: input.userId,
    kind: "board_saved",
    title: "Imagen guardada en tablero",
    body: `Se guardo en "${sanitizeText(input.boardTitle, 90)}".`,
    ctaPath: `/boards/${input.boardId}`,
    eventKey: `board_saved:${input.userId}:${input.boardId}:${input.imageId}`,
    sourceImageId: input.imageId,
    sourceBoardId: input.boardId,
    payload: {
      boardId: input.boardId,
      imageId: input.imageId,
      boardTitle: input.boardTitle,
    },
  })
}

export async function notifyImageSavedByOther(input: {
  ownerUserId: string
  imageId: string
  boardId: string
  boardTitle: string
  savedByUsername: string
}) {
  return enqueueUserNotification({
    userId: input.ownerUserId,
    kind: "image_saved_by_other",
    title: "Guardaron una imagen tuya",
    body: `@${sanitizeText(input.savedByUsername, 36)} la guardo en "${sanitizeText(input.boardTitle, 90)}".`,
    ctaPath: `/boards/${input.boardId}`,
    eventKey: `image_saved_by_other:${input.imageId}:${input.boardId}:${input.savedByUsername}`,
    sourceImageId: input.imageId,
    sourceBoardId: input.boardId,
    payload: {
      boardId: input.boardId,
      imageId: input.imageId,
      savedByUsername: input.savedByUsername,
    },
  })
}

export async function notifyLikeMilestone(input: {
  ownerUserId: string
  imageId: string
  milestone: number
}) {
  return enqueueUserNotification({
    userId: input.ownerUserId,
    kind: "like_milestone",
    title: "Nuevo hito de likes",
    body: `Tu imagen alcanzo ${input.milestone} likes.`,
    ctaPath: "/",
    eventKey: `like_milestone:${input.imageId}:${input.milestone}`,
    sourceImageId: input.imageId,
    payload: {
      imageId: input.imageId,
      milestone: input.milestone,
    },
  })
}

export async function notifySuperlikeReceived(input: {
  ownerUserId: string
  imageId: string
  superlikeCount: number | null
}) {
  const countSuffix =
    typeof input.superlikeCount === "number" && Number.isFinite(input.superlikeCount)
      ? ` Ya tiene ${Math.max(0, Math.floor(input.superlikeCount))} superlikes.`
      : ""

  return enqueueUserNotification({
    userId: input.ownerUserId,
    kind: "superlike_received",
    title: "Recibiste un superlike",
    body: `Tu imagen recibio un superlike.${countSuffix}`,
    ctaPath: "/",
    eventKey: `superlike_received:${input.imageId}:${input.superlikeCount ?? "na"}`,
    sourceImageId: input.imageId,
    payload: {
      imageId: input.imageId,
      superlikeCount: input.superlikeCount,
    },
  })
}
