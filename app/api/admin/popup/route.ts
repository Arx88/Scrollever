import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { SETTING_DEFINITIONS_MAP, coerceSettingValue } from "@/lib/admin/config-catalog"
import {
  adminApiErrorResponse,
  AdminApiError,
  logAdminAudit,
  requireAdminApiContext,
  type AdminApiContext,
} from "@/lib/admin/api-auth"
import {
  DEFAULT_LOGIN_POPUP_CONFIG,
  LOGIN_POPUP_SETTING_KEYS,
  getLoginPopupConfigFromSettings,
  type LoginPopupConfig,
  type LoginPopupLayout,
  parsePopupLibrary,
  toPopupLibraryItem,
  type PopupLibraryItem,
} from "@/lib/admin/popup-config"

const popupKeys = Object.values(LOGIN_POPUP_SETTING_KEYS)

const popupLayoutSchema = z.object({
  widthPercent: z.number().min(60).max(130).optional(),
  heightPercent: z.number().min(60).max(130).optional(),
  sizePercent: z.number().min(60).max(130).optional(),
  titleSizePercent: z.number().min(40).max(180).optional(),
  messageSizePercent: z.number().min(50).max(180).optional(),
  buttonSizePercent: z.number().min(50).max(180).optional(),
  radiusPx: z.number().min(28).max(260).optional(),
  contentOffsetX: z.number().min(-200).max(200).optional(),
  contentOffsetY: z.number().min(-220).max(220).optional(),
  titleOffsetY: z.number().min(-140).max(140).optional(),
  messageOffsetY: z.number().min(-140).max(140).optional(),
  buttonOffsetY: z.number().min(-140).max(140).optional(),
})

const popupUpdateSchema = z.object({
  action: z.enum(["create", "update", "activate"]),
  popupId: z.string().trim().min(1).max(128).optional(),
  item: z.unknown().optional(),
})

interface AppSettingRow {
  key: string
  value_json: unknown
}

interface PopupState {
  item: LoginPopupConfig
  library: PopupLibraryItem[]
  activeId: string | null
}

function asTrimmedString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }

  return normalized.slice(0, maxLength)
}

function asBoolean(value: unknown, fallback: boolean): boolean {
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

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, parsed))
}

function mergeLayoutWithFallback(
  incoming: Partial<LoginPopupLayout> | undefined,
  base: LoginPopupLayout
): LoginPopupLayout {
  const fallback = DEFAULT_LOGIN_POPUP_CONFIG.layout
  const widthPercent = incoming?.widthPercent ?? incoming?.sizePercent ?? base.widthPercent ?? base.sizePercent ?? fallback.widthPercent
  const heightPercent = incoming?.heightPercent ?? incoming?.sizePercent ?? base.heightPercent ?? base.sizePercent ?? fallback.heightPercent

  return {
    widthPercent,
    heightPercent,
    sizePercent: widthPercent,
    titleSizePercent: incoming?.titleSizePercent ?? base.titleSizePercent ?? fallback.titleSizePercent,
    messageSizePercent: incoming?.messageSizePercent ?? base.messageSizePercent ?? fallback.messageSizePercent,
    buttonSizePercent: incoming?.buttonSizePercent ?? base.buttonSizePercent ?? fallback.buttonSizePercent,
    radiusPx: incoming?.radiusPx ?? base.radiusPx ?? fallback.radiusPx,
    contentOffsetX: incoming?.contentOffsetX ?? base.contentOffsetX ?? fallback.contentOffsetX,
    contentOffsetY: incoming?.contentOffsetY ?? base.contentOffsetY ?? fallback.contentOffsetY,
    titleOffsetY: incoming?.titleOffsetY ?? base.titleOffsetY ?? fallback.titleOffsetY,
    messageOffsetY: incoming?.messageOffsetY ?? base.messageOffsetY ?? fallback.messageOffsetY,
    buttonOffsetY: incoming?.buttonOffsetY ?? base.buttonOffsetY ?? fallback.buttonOffsetY,
  }
}

function normalizeIncomingLayout(raw: unknown, base: LoginPopupLayout): LoginPopupLayout {
  const source = typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}

  const layoutCandidate: Partial<LoginPopupLayout> = {
    widthPercent: clampNumber(source.widthPercent, base.widthPercent, 60, 130),
    heightPercent: clampNumber(source.heightPercent, base.heightPercent, 60, 130),
    sizePercent: clampNumber(source.sizePercent, base.sizePercent, 60, 130),
    titleSizePercent: clampNumber(source.titleSizePercent, base.titleSizePercent, 40, 180),
    messageSizePercent: clampNumber(source.messageSizePercent, base.messageSizePercent, 50, 180),
    buttonSizePercent: clampNumber(source.buttonSizePercent, base.buttonSizePercent, 50, 180),
    radiusPx: clampNumber(source.radiusPx, base.radiusPx, 28, 260),
    contentOffsetX: clampNumber(source.contentOffsetX, base.contentOffsetX, -200, 200),
    contentOffsetY: clampNumber(source.contentOffsetY, base.contentOffsetY, -220, 220),
    titleOffsetY: clampNumber(source.titleOffsetY, base.titleOffsetY, -140, 140),
    messageOffsetY: clampNumber(source.messageOffsetY, base.messageOffsetY, -140, 140),
    buttonOffsetY: clampNumber(source.buttonOffsetY, base.buttonOffsetY, -140, 140),
  }

  // Final shape always normalized and consistent.
  return mergeLayoutWithFallback(layoutCandidate, base)
}

function normalizeIncomingConfig(raw: unknown, base: LoginPopupConfig): LoginPopupConfig {
  const source = typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}

  return {
    enabled: asBoolean(source.enabled, base.enabled),
    title: asTrimmedString(source.title, base.title, 120),
    message: asTrimmedString(source.message, base.message, 700),
    confirmLabel: asTrimmedString(source.confirmLabel, base.confirmLabel, 60),
    imageUrl: asTrimmedString(source.imageUrl, base.imageUrl, 2000),
    version: asTrimmedString(source.version, base.version, 64),
    layout: normalizeIncomingLayout(source.layout, base.layout),
  }
}

function toSettingEntries(config: LoginPopupConfig, library: PopupLibraryItem[], activeId: string | null) {
  return [
    { key: LOGIN_POPUP_SETTING_KEYS.enabled, value: config.enabled },
    { key: LOGIN_POPUP_SETTING_KEYS.title, value: config.title },
    { key: LOGIN_POPUP_SETTING_KEYS.message, value: config.message },
    { key: LOGIN_POPUP_SETTING_KEYS.confirmLabel, value: config.confirmLabel },
    { key: LOGIN_POPUP_SETTING_KEYS.imageUrl, value: config.imageUrl },
    { key: LOGIN_POPUP_SETTING_KEYS.version, value: config.version },
    { key: LOGIN_POPUP_SETTING_KEYS.layout, value: config.layout },
    { key: LOGIN_POPUP_SETTING_KEYS.activeId, value: activeId ?? "popup-default" },
    { key: LOGIN_POPUP_SETTING_KEYS.library, value: library },
  ]
}

function parseActiveId(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function ensureUniqueVersion(version: string, library: PopupLibraryItem[], skipId?: string | null) {
  const normalized = version.trim()
  const exists = library.some((item) => item.version === normalized && item.id !== skipId)
  if (!exists) {
    return normalized
  }

  return `${normalized}-${Date.now()}`
}

async function readPopupState(context: AdminApiContext): Promise<PopupState> {
  const { data, error } = await context.supabase
    .from("app_settings")
    .select("key,value_json")
    .in("key", popupKeys)

  if (error) {
    throw error
  }

  const settings: Record<string, unknown> = {}
  for (const row of (data ?? []) as AppSettingRow[]) {
    settings[row.key] = row.value_json
  }

  const item = getLoginPopupConfigFromSettings(settings)
  const activeId = parseActiveId(settings[LOGIN_POPUP_SETTING_KEYS.activeId])
  let library = parsePopupLibrary(settings[LOGIN_POPUP_SETTING_KEYS.library]).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )

  if (library.length === 0) {
    const fallback = toPopupLibraryItem(item, {
      id: activeId ?? "popup-default",
    })
    library = [fallback]
  }

  return {
    item,
    library,
    activeId: activeId ?? library[0]?.id ?? null,
  }
}

async function savePopupState(context: AdminApiContext, nextState: PopupState) {
  const rows = toSettingEntries(nextState.item, nextState.library, nextState.activeId).map(({ key, value }) => {
    const definition = SETTING_DEFINITIONS_MAP.get(key)
    if (!definition) {
      throw new Error(`Missing setting definition for ${key}`)
    }

    const normalizedValue = coerceSettingValue(definition, value)
    return {
      key,
      value_json: normalizedValue,
      value_type: definition.type,
      category: definition.category,
      description: definition.description,
      is_public: definition.isPublic,
      updated_by: context.userId,
    }
  })

  const { error } = await context.supabase.from("app_settings").upsert(rows)
  if (error) {
    console.error("[admin/popup] upsert_error", error)
    throw new AdminApiError(500, "POPUP_UPDATE_FAILED", "Failed to update popup settings")
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const state = await readPopupState(context)
    return NextResponse.json({
      item: state.item,
      library: state.library,
      activeId: state.activeId,
      canvas: {
        width: 1130,
        height: 700,
      },
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request)
    const rawBody = await request.json()
    const parsed = popupUpdateSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const currentState = await readPopupState(context)
    const { action, popupId, item } = parsed.data

    if ((action === "create" || action === "update") && !item) {
      return NextResponse.json({ error: "Popup item is required" }, { status: 400 })
    }

    let nextState = { ...currentState }

    if (action === "create" && item) {
      const normalizedItem = normalizeIncomingConfig(item, currentState.item)
      const uniqueVersion = ensureUniqueVersion(normalizedItem.version, currentState.library)
      const createdConfig: LoginPopupConfig = {
        ...normalizedItem,
        version: uniqueVersion,
      }

      const created = toPopupLibraryItem(createdConfig)
      nextState = {
        item: createdConfig,
        library: [created, ...currentState.library].slice(0, 120),
        activeId: created.id,
      }
    }

    if (action === "update" && item) {
      const targetId = popupId ?? currentState.activeId
      if (!targetId) {
        return NextResponse.json({ error: "No popup selected to update" }, { status: 400 })
      }

      const existing = currentState.library.find((entry) => entry.id === targetId)
      const normalizedItem = normalizeIncomingConfig(item, existing ? {
        enabled: currentState.item.enabled,
        title: existing.title,
        message: existing.message,
        confirmLabel: existing.confirmLabel,
        imageUrl: existing.imageUrl,
        version: existing.version,
        layout: existing.layout,
      } : currentState.item)
      const uniqueVersion = ensureUniqueVersion(normalizedItem.version, currentState.library, targetId)
      const updatedConfig: LoginPopupConfig = {
        ...normalizedItem,
        version: uniqueVersion,
      }
      const updated = toPopupLibraryItem(updatedConfig, {
        id: targetId,
        createdAt: existing?.createdAt,
        updatedAt: new Date().toISOString(),
      })

      const updatedLibrary = currentState.library.some((entry) => entry.id === targetId)
        ? currentState.library.map((entry) => (entry.id === targetId ? updated : entry))
        : [updated, ...currentState.library]

      nextState = {
        item: updatedConfig,
        library: updatedLibrary.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 120),
        activeId: targetId,
      }
    }

    if (action === "activate") {
      const targetId = popupId
      if (!targetId) {
        return NextResponse.json({ error: "popupId is required for activate" }, { status: 400 })
      }

      const selected = currentState.library.find((entry) => entry.id === targetId)
      if (!selected) {
        return NextResponse.json({ error: "Popup not found in library" }, { status: 404 })
      }

      nextState = {
        item: {
          enabled: currentState.item.enabled,
          title: selected.title,
          message: selected.message,
          confirmLabel: selected.confirmLabel,
          imageUrl: selected.imageUrl,
          version: selected.version,
          layout: selected.layout,
        },
        library: currentState.library,
        activeId: selected.id,
      }
    }

    await savePopupState(context, nextState)
    await logAdminAudit(context, `popup.${action}`, "app_settings", "popup.login", {
      action,
      popupId: nextState.activeId,
      version: nextState.item.version,
    })

    return NextResponse.json({
      item: nextState.item,
      library: nextState.library,
      activeId: nextState.activeId,
      canvas: {
        width: 1130,
        height: 700,
      },
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
