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
    description: "Likes requeridos por defecto para sobrevivir.",
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
    key: "logging.level",
    category: "ops",
    type: "string",
    description: "Nivel de logging backend.",
    defaultValue: "info",
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
