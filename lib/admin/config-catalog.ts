export type SettingType = "number" | "boolean" | "string" | "json" | "string_array"

export interface SettingDefinition {
  key: string
  category: string
  type: SettingType
  description: string
  defaultValue: unknown
  isPublic: boolean
}

export interface FeatureFlagDefinition {
  key: string
  description: string
  defaultEnabled: boolean
  defaultRollout: number
  isPublic: boolean
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "superlike.daily_limit",
    category: "superlike",
    type: "number",
    description: "Cantidad de superlikes por usuario por dia UTC.",
    defaultValue: 1,
    isPublic: false,
  },
  {
    key: "superlike.reset_timezone",
    category: "superlike",
    type: "string",
    description: "Zona horaria de reinicio del superlike.",
    defaultValue: "UTC",
    isPublic: false,
  },
  {
    key: "feed.limit_default",
    category: "feed",
    type: "number",
    description: "Cantidad de items iniciales por request.",
    defaultValue: 20,
    isPublic: true,
  },
  {
    key: "feed.limit_max",
    category: "feed",
    type: "number",
    description: "Maximo de items permitidos por request.",
    defaultValue: 50,
    isPublic: false,
  },
  {
    key: "feed.cache_ttl_ms",
    category: "feed",
    type: "number",
    description: "TTL de cache cliente para feed.",
    defaultValue: 30000,
    isPublic: false,
  },
  {
    key: "feed.fallback_enabled",
    category: "feed",
    type: "boolean",
    description: "Activa fallback visual cuando falla Supabase.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "survival.likes_needed_default",
    category: "survival",
    type: "number",
    description: "Fallback de likes requeridos cuando el ranking vivo no esta disponible.",
    defaultValue: 5000,
    isPublic: false,
  },
  {
    key: "survival.window_hours",
    category: "survival",
    type: "number",
    description: "Ventana de supervivencia en horas.",
    defaultValue: 24,
    isPublic: false,
  },
  {
    key: "survival.top_percentage",
    category: "survival",
    type: "number",
    description: "Porcentaje top por cohorte que sobrevive (0.15 = top 15%).",
    defaultValue: 0.15,
    isPublic: false,
  },
  {
    key: "survival.superlike_weight",
    category: "survival",
    type: "number",
    description:
      "Peso del superlike en Hall of Fame. No afecta supervivencia mientras Opcion A este activa.",
    defaultValue: 4,
    isPublic: false,
  },
  {
    key: "hof.min_superlikes",
    category: "hall_of_fame",
    type: "number",
    description: "Minimo de superlikes sugerido para Hall of Fame.",
    defaultValue: 50,
    isPublic: false,
  },
  {
    key: "hof.rank_weights",
    category: "hall_of_fame",
    type: "json",
    description: "Pesos de ranking para Hall of Fame.",
    defaultValue: {
      superlikes: 1,
      likes: 0.25,
      recency: 0.1,
    },
    isPublic: false,
  },
  {
    key: "auth.signup_enabled",
    category: "auth",
    type: "boolean",
    description: "Permite o bloquea nuevos registros.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "auth.email_confirmation_required",
    category: "auth",
    type: "boolean",
    description: "Exige confirmacion de email.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "auth.password_min_length",
    category: "auth",
    type: "number",
    description: "Longitud minima de password.",
    defaultValue: 6,
    isPublic: false,
  },
  {
    key: "auth.blocked_email_domains",
    category: "auth",
    type: "string_array",
    description: "Dominios de email bloqueados.",
    defaultValue: [],
    isPublic: false,
  },
  {
    key: "moderation.blocked_words",
    category: "moderation",
    type: "string_array",
    description: "Palabras bloqueadas para prompts/titulos.",
    defaultValue: [],
    isPublic: false,
  },
  {
    key: "moderation.allowed_image_domains",
    category: "moderation",
    type: "string_array",
    description: "Lista blanca opcional de dominios de imagen.",
    defaultValue: [],
    isPublic: false,
  },
  {
    key: "login.hero.source",
    category: "ui",
    type: "string",
    description: "Fuente del hero login: immortal | hall_of_fame | manual.",
    defaultValue: "immortal",
    isPublic: true,
  },
  {
    key: "login.hero.rotation_seconds",
    category: "ui",
    type: "number",
    description: "Segundos entre cada imagen de hero login.",
    defaultValue: 5,
    isPublic: true,
  },
  {
    key: "popup.login.enabled",
    category: "popup",
    type: "boolean",
    description: "Activa popup informativo despues del login.",
    defaultValue: true,
    isPublic: true,
  },
  {
    key: "popup.login.title",
    category: "popup",
    type: "string",
    description: "Titulo principal del popup de login.",
    defaultValue: "SCROLLEVER",
    isPublic: true,
  },
  {
    key: "popup.login.message",
    category: "popup",
    type: "string",
    description: "Texto descriptivo del popup de login.",
    defaultValue:
      "24 horas para volverse eterno. Tu imagen tiene lo que hace falta? El feed esteticamente mas exigente de internet.",
    isPublic: true,
  },
  {
    key: "popup.login.confirm_label",
    category: "popup",
    type: "string",
    description: "Texto del boton de confirmacion del popup.",
    defaultValue: "COMENZAR",
    isPublic: true,
  },
  {
    key: "popup.login.image_url",
    category: "popup",
    type: "string",
    description: "URL de imagen para el panel visual izquierdo del popup.",
    defaultValue: "/provisional/Imagen%202.png",
    isPublic: true,
  },
  {
    key: "popup.login.version",
    category: "popup",
    type: "string",
    description: "Version del popup para controlar reaparicion por usuario.",
    defaultValue: "v1",
    isPublic: true,
  },
  {
    key: "popup.login.layout",
    category: "popup",
    type: "json",
    description: "Layout visual del popup (tamano, bordes y offsets de bloques).",
    defaultValue: {
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
    isPublic: true,
  },
  {
    key: "popup.login.active_id",
    category: "popup",
    type: "string",
    description: "Identificador del popup activo seleccionado.",
    defaultValue: "popup-default",
    isPublic: false,
  },
  {
    key: "popup.login.library",
    category: "popup",
    type: "json",
    description: "Biblioteca historica de popups informativos para reutilizar.",
    defaultValue: [],
    isPublic: false,
  },
  {
    key: "notifications.enabled",
    category: "notifications",
    type: "boolean",
    description: "Activa notificaciones in-app para feedback de creacion y engagement.",
    defaultValue: true,
    isPublic: true,
  },
  {
    key: "notifications.creator_loop_enabled",
    category: "notifications",
    type: "boolean",
    description: "Activa notificaciones automaticas del loop de creadores.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "notifications.max_items_per_user",
    category: "notifications",
    type: "number",
    description: "Cantidad maxima de notificaciones persistidas por usuario.",
    defaultValue: 200,
    isPublic: false,
  },
  {
    key: "notifications.default_fetch_limit",
    category: "notifications",
    type: "number",
    description: "Cantidad por defecto de notificaciones por request.",
    defaultValue: 20,
    isPublic: true,
  },
  {
    key: "analytics.events_enabled",
    category: "analytics",
    type: "boolean",
    description: "Activa tracking de eventos de producto y cohortes causales.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "analytics.backfill_window_hours",
    category: "analytics",
    type: "number",
    description: "Ventana de backfill en horas para incidentes de ingestion.",
    defaultValue: 72,
    isPublic: false,
  },
  {
    key: "analytics.qualified_session_min_seconds",
    category: "analytics",
    type: "number",
    description: "Segundos minimos para considerar sesion calificada si no llega a 2 page views.",
    defaultValue: 10,
    isPublic: false,
  },
  {
    key: "analytics.internal_ip_blocklist",
    category: "analytics",
    type: "string_array",
    description: "IPs/CIDRs internas a excluir de UV/sesiones/conversion (QA, staging, oficina).",
    defaultValue: [],
    isPublic: false,
  },
  {
    key: "logging.level",
    category: "ops",
    type: "string",
    description: "Nivel de logging backend.",
    defaultValue: "info",
    isPublic: false,
  },
  {
    key: "generation.enabled",
    category: "generation",
    type: "boolean",
    description: "Activa la generacion de imagenes AI.",
    defaultValue: true,
    isPublic: true,
  },
  {
    key: "generation.daily_free_limit",
    category: "generation",
    type: "number",
    description: "Cantidad de imagenes gratis por usuario por dia UTC.",
    defaultValue: 5,
    isPublic: true,
  },
  {
    key: "generation.default_aspect_ratio",
    category: "generation",
    type: "string",
    description: "Aspect ratio por defecto del creador.",
    defaultValue: "9:16",
    isPublic: true,
  },
  {
    key: "generation.max_prompt_length",
    category: "generation",
    type: "number",
    description: "Longitud maxima de prompt permitida.",
    defaultValue: 2000,
    isPublic: false,
  },
  {
    key: "generation.default_model_key",
    category: "generation",
    type: "string",
    description: "Modelo default del creador.",
    defaultValue: "gpt-image-1",
    isPublic: true,
  },
  {
    key: "generation.queue_enabled",
    category: "generation",
    type: "boolean",
    description: "Permite encolar jobs de generacion.",
    defaultValue: true,
    isPublic: false,
  },
  {
    key: "boards.max_per_user",
    category: "boards",
    type: "number",
    description: "Cantidad maxima de tableros por usuario.",
    defaultValue: 100,
    isPublic: false,
  },
  {
    key: "boards.max_items_per_board",
    category: "boards",
    type: "number",
    description: "Cantidad maxima de imagenes por tablero.",
    defaultValue: 500,
    isPublic: false,
  },
]

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: "admin.panel_enabled",
    description: "Habilita el panel administrativo.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: false,
  },
  {
    key: "feed.experimental_ranking",
    description: "Habilita ranking experimental para feed.",
    defaultEnabled: false,
    defaultRollout: 0,
    isPublic: false,
  },
  {
    key: "moderation.strict_mode",
    description: "Activa reglas estrictas de moderacion.",
    defaultEnabled: false,
    defaultRollout: 0,
    isPublic: false,
  },
  {
    key: "ui.dynamic_login_hero",
    description: "Permite hero login dinamico.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: true,
  },
  {
    key: "ai.creator_enabled",
    description: "Activa el creador de imagenes AI.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: true,
  },
  {
    key: "ai.multi_provider_enabled",
    description: "Activa arquitectura multi provider.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: false,
  },
  {
    key: "boards.enabled",
    description: "Activa tableros estilo Pinterest.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: true,
  },
  {
    key: "boards.collab_enabled",
    description: "Activa tableros colaborativos.",
    defaultEnabled: true,
    defaultRollout: 100,
    isPublic: true,
  },
]

export const SETTING_DEFINITIONS_MAP = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition])
)

export const FEATURE_FLAG_DEFINITIONS_MAP = new Map(
  FEATURE_FLAG_DEFINITIONS.map((definition) => [definition.key, definition])
)

function isPlainObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function coerceSettingValue(definition: SettingDefinition, value: unknown): unknown {
  if (definition.type === "number") {
    const parsed = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric value for ${definition.key}`)
    }
    return parsed
  }

  if (definition.type === "boolean") {
    if (typeof value === "boolean") {
      return value
    }

    if (value === "true") {
      return true
    }

    if (value === "false") {
      return false
    }

    throw new Error(`Invalid boolean value for ${definition.key}`)
  }

  if (definition.type === "string") {
    if (typeof value !== "string") {
      throw new Error(`Invalid string value for ${definition.key}`)
    }
    return value.trim()
  }

  if (definition.type === "string_array") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new Error(`Invalid string_array value for ${definition.key}`)
    }

    return value.map((item) => item.trim()).filter(Boolean)
  }

  if (definition.type === "json") {
    if (isPlainObject(value) || Array.isArray(value) || value === null) {
      return value
    }

    throw new Error(`Invalid json value for ${definition.key}`)
  }

  return value
}

export function getDefaultSettingValue(key: string): unknown {
  const definition = SETTING_DEFINITIONS_MAP.get(key)
  return definition?.defaultValue ?? null
}
