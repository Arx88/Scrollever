import { createClient } from "@/lib/supabase/server"
import {
  FEATURE_FLAG_DEFINITIONS,
  SETTING_DEFINITIONS,
  SETTING_DEFINITIONS_MAP,
  coerceSettingValue,
} from "@/lib/admin/config-catalog"

export interface PublicAppConfig {
  settings: Record<string, unknown>
  flags: Record<string, { enabled: boolean; rollout: number }>
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getPublicDefaults(): PublicAppConfig {
  const settings: Record<string, unknown> = {}
  const flags: Record<string, { enabled: boolean; rollout: number }> = {}

  for (const definition of SETTING_DEFINITIONS) {
    if (definition.isPublic) {
      settings[definition.key] = definition.defaultValue
    }
  }

  for (const definition of FEATURE_FLAG_DEFINITIONS) {
    if (definition.isPublic) {
      flags[definition.key] = {
        enabled: definition.defaultEnabled,
        rollout: definition.defaultRollout,
      }
    }
  }

  return { settings, flags }
}

export async function getPublicRuntimeConfig(): Promise<PublicAppConfig> {
  const fallback = getPublicDefaults()
  if (!isSupabaseConfigured()) {
    return fallback
  }

  try {
    const supabase = await createClient()
    const [{ data: settingsRows }, { data: flagRows }] = await Promise.all([
      supabase.from("app_settings").select("key,value_json,is_public").eq("is_public", true),
      supabase.from("feature_flags").select("key,enabled,rollout,is_public").eq("is_public", true),
    ])

    for (const row of settingsRows ?? []) {
      const definition = SETTING_DEFINITIONS_MAP.get(row.key)
      if (!definition || !definition.isPublic) {
        continue
      }

      try {
        fallback.settings[row.key] = coerceSettingValue(definition, row.value_json)
      } catch {
        fallback.settings[row.key] = definition.defaultValue
      }
    }

    for (const row of flagRows ?? []) {
      fallback.flags[row.key] = {
        enabled: Boolean(row.enabled),
        rollout: Math.max(0, Math.min(100, Number(row.rollout ?? 0))),
      }
    }

    return fallback
  } catch (error) {
    console.error("[public-config] fallback_due_error", error)
    return fallback
  }
}
