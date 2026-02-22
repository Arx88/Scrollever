export const LOGIN_POPUP_SETTING_KEYS = {
  enabled: "popup.login.enabled",
  title: "popup.login.title",
  message: "popup.login.message",
  confirmLabel: "popup.login.confirm_label",
  imageUrl: "popup.login.image_url",
  version: "popup.login.version",
  layout: "popup.login.layout",
  activeId: "popup.login.active_id",
  library: "popup.login.library",
} as const

export interface LoginPopupLayout {
  widthPercent: number
  heightPercent: number
  // Legacy scalar kept for backward compatibility with previously persisted configs.
  sizePercent: number
  titleSizePercent: number
  messageSizePercent: number
  buttonSizePercent: number
  radiusPx: number
  contentOffsetX: number
  contentOffsetY: number
  titleOffsetY: number
  messageOffsetY: number
  buttonOffsetY: number
}

export interface LoginPopupConfig {
  enabled: boolean
  title: string
  message: string
  confirmLabel: string
  imageUrl: string
  version: string
  layout: LoginPopupLayout
}

export interface PopupLibraryItem {
  id: string
  title: string
  message: string
  confirmLabel: string
  imageUrl: string
  version: string
  layout: LoginPopupLayout
  createdAt: string
  updatedAt: string
}

export const DEFAULT_LOGIN_POPUP_CONFIG: LoginPopupConfig = {
  enabled: true,
  title: "SCROLLEVER",
  message:
    "24 horas para volverse eterno. Tu imagen tiene lo que hace falta? El feed esteticamente mas exigente de internet.",
  confirmLabel: "COMENZAR",
  imageUrl: "/provisional/Imagen%202.png",
  version: "v1",
  layout: {
    widthPercent: 100,
    heightPercent: 100,
    sizePercent: 100,
    titleSizePercent: 100,
    messageSizePercent: 100,
    buttonSizePercent: 100,
    radiusPx: 72,
    contentOffsetX: 0,
    contentOffsetY: 0,
    titleOffsetY: 0,
    messageOffsetY: 0,
    buttonOffsetY: 0,
  },
}

function asTrimmedString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : fallback
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  return fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(min, Math.min(max, parsed))
}

function normalizeLayout(value: unknown): LoginPopupLayout {
  const source = typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  const legacyScale = clampNumber(source.sizePercent, DEFAULT_LOGIN_POPUP_CONFIG.layout.sizePercent, 60, 130)
  const widthPercent = clampNumber(source.widthPercent, legacyScale, 60, 130)
  const heightPercent = clampNumber(source.heightPercent, legacyScale, 60, 130)

  return {
    widthPercent,
    heightPercent,
    sizePercent: widthPercent,
    titleSizePercent: clampNumber(source.titleSizePercent, DEFAULT_LOGIN_POPUP_CONFIG.layout.titleSizePercent, 40, 180),
    messageSizePercent: clampNumber(source.messageSizePercent, DEFAULT_LOGIN_POPUP_CONFIG.layout.messageSizePercent, 50, 180),
    buttonSizePercent: clampNumber(source.buttonSizePercent, DEFAULT_LOGIN_POPUP_CONFIG.layout.buttonSizePercent, 50, 180),
    radiusPx: clampNumber(source.radiusPx, DEFAULT_LOGIN_POPUP_CONFIG.layout.radiusPx, 28, 260),
    contentOffsetX: clampNumber(source.contentOffsetX, DEFAULT_LOGIN_POPUP_CONFIG.layout.contentOffsetX, -200, 200),
    contentOffsetY: clampNumber(source.contentOffsetY, DEFAULT_LOGIN_POPUP_CONFIG.layout.contentOffsetY, -220, 220),
    titleOffsetY: clampNumber(source.titleOffsetY, DEFAULT_LOGIN_POPUP_CONFIG.layout.titleOffsetY, -140, 140),
    messageOffsetY: clampNumber(source.messageOffsetY, DEFAULT_LOGIN_POPUP_CONFIG.layout.messageOffsetY, -140, 140),
    buttonOffsetY: clampNumber(source.buttonOffsetY, DEFAULT_LOGIN_POPUP_CONFIG.layout.buttonOffsetY, -140, 140),
  }
}

function normalizeLibraryItem(value: unknown): PopupLibraryItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const row = value as Record<string, unknown>
  const id = asTrimmedString(row.id, "")
  const title = asTrimmedString(row.title, "")
  const message = asTrimmedString(row.message, "")
  const confirmLabel = asTrimmedString(row.confirmLabel, "")
  const imageUrl = asTrimmedString(row.imageUrl, "")
  const version = asTrimmedString(row.version, "")
  const createdAt = asTrimmedString(row.createdAt, "")
  const updatedAt = asTrimmedString(row.updatedAt, "")
  const layout = normalizeLayout(row.layout)

  if (!id || !title || !message || !confirmLabel || !imageUrl || !version || !createdAt || !updatedAt) {
    return null
  }

  return {
    id,
    title,
    message,
    confirmLabel,
    imageUrl,
    version,
    layout,
    createdAt,
    updatedAt,
  }
}

export function parsePopupLibrary(value: unknown): PopupLibraryItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => normalizeLibraryItem(entry))
    .filter((entry): entry is PopupLibraryItem => Boolean(entry))
}

export function toPopupLibraryItem(
  config: LoginPopupConfig,
  params?: {
    id?: string
    createdAt?: string
    updatedAt?: string
  }
): PopupLibraryItem {
  const now = new Date().toISOString()
  const randomId = `popup-${now.replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id: params?.id ?? randomId,
    title: config.title,
    message: config.message,
    confirmLabel: config.confirmLabel,
    imageUrl: config.imageUrl,
    version: config.version,
    layout: normalizeLayout(config.layout),
    createdAt: params?.createdAt ?? now,
    updatedAt: params?.updatedAt ?? now,
  }
}

export function getLoginPopupConfigFromSettings(
  settings?: Record<string, unknown> | null
): LoginPopupConfig {
  const source = settings ?? {}

  return {
    enabled: asBoolean(source[LOGIN_POPUP_SETTING_KEYS.enabled], DEFAULT_LOGIN_POPUP_CONFIG.enabled),
    title: asTrimmedString(source[LOGIN_POPUP_SETTING_KEYS.title], DEFAULT_LOGIN_POPUP_CONFIG.title),
    message: asTrimmedString(source[LOGIN_POPUP_SETTING_KEYS.message], DEFAULT_LOGIN_POPUP_CONFIG.message),
    confirmLabel: asTrimmedString(
      source[LOGIN_POPUP_SETTING_KEYS.confirmLabel],
      DEFAULT_LOGIN_POPUP_CONFIG.confirmLabel
    ),
    imageUrl: asTrimmedString(source[LOGIN_POPUP_SETTING_KEYS.imageUrl], DEFAULT_LOGIN_POPUP_CONFIG.imageUrl),
    version: asTrimmedString(source[LOGIN_POPUP_SETTING_KEYS.version], DEFAULT_LOGIN_POPUP_CONFIG.version),
    layout: normalizeLayout(source[LOGIN_POPUP_SETTING_KEYS.layout]),
  }
}
