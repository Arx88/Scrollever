import { coerceSettingValue, SETTING_DEFINITIONS_MAP } from "@/lib/admin/config-catalog"

export interface GenerationRuntimeSettings {
  enabled: boolean
  dailyFreeLimit: number
  maxPromptLength: number
  defaultModelKey: string
  defaultAspectRatio: string
  queueEnabled: boolean
}

const SETTINGS_KEYS = [
  "generation.enabled",
  "generation.daily_free_limit",
  "generation.max_prompt_length",
  "generation.default_model_key",
  "generation.default_aspect_ratio",
  "generation.queue_enabled",
] as const

function getSettingFallback<T>(key: string): T {
  const definition = SETTING_DEFINITIONS_MAP.get(key)
  return (definition?.defaultValue ?? null) as T
}

export async function getGenerationRuntimeSettings(supabase: any): Promise<GenerationRuntimeSettings> {
  const fallback: GenerationRuntimeSettings = {
    enabled: getSettingFallback<boolean>("generation.enabled"),
    dailyFreeLimit: getSettingFallback<number>("generation.daily_free_limit"),
    maxPromptLength: getSettingFallback<number>("generation.max_prompt_length"),
    defaultModelKey: getSettingFallback<string>("generation.default_model_key"),
    defaultAspectRatio: getSettingFallback<string>("generation.default_aspect_ratio"),
    queueEnabled: getSettingFallback<boolean>("generation.queue_enabled"),
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value_json")
      .in("key", SETTINGS_KEYS)

    if (error || !data) {
      return fallback
    }

    for (const row of data) {
      const definition = SETTING_DEFINITIONS_MAP.get(row.key)
      if (!definition) {
        continue
      }

      try {
        const value = coerceSettingValue(definition, row.value_json)
        if (row.key === "generation.enabled") fallback.enabled = Boolean(value)
        if (row.key === "generation.daily_free_limit") fallback.dailyFreeLimit = Math.max(0, Number(value))
        if (row.key === "generation.max_prompt_length") fallback.maxPromptLength = Math.max(100, Number(value))
        if (row.key === "generation.default_model_key") fallback.defaultModelKey = String(value || "")
        if (row.key === "generation.default_aspect_ratio") fallback.defaultAspectRatio = String(value || "9:16")
        if (row.key === "generation.queue_enabled") fallback.queueEnabled = Boolean(value)
      } catch {
        // Keep fallback for invalid values.
      }
    }
  } catch {
    return fallback
  }

  return fallback
}

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}
