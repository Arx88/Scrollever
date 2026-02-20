import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  SETTING_DEFINITIONS,
  SETTING_DEFINITIONS_MAP,
  coerceSettingValue,
} from "@/lib/admin/config-catalog"
import {
  adminApiErrorResponse,
  logAdminAudit,
  requireAdminApiContext,
  type AdminApiContext,
} from "@/lib/admin/api-auth"

const updateSettingSchema = z.object({
  key: z.string().trim().min(1),
  value: z.unknown(),
})

interface SettingsRow {
  key: string
  value_json: unknown
  value_type: string
  category: string
  description: string | null
  is_public: boolean
  updated_at: string
}

function buildSettingsPayload(rows: SettingsRow[]) {
  const rowMap = new Map(rows.map((row) => [row.key, row]))

  return SETTING_DEFINITIONS.map((definition) => {
    const row = rowMap.get(definition.key)
    if (!row) {
      return {
        key: definition.key,
        category: definition.category,
        type: definition.type,
        description: definition.description,
        isPublic: definition.isPublic,
        value: definition.defaultValue,
        source: "default",
        updatedAt: null,
      }
    }

    try {
      return {
        key: definition.key,
        category: definition.category,
        type: definition.type,
        description: definition.description,
        isPublic: definition.isPublic,
        value: coerceSettingValue(definition, row.value_json),
        source: "database",
        updatedAt: row.updated_at,
      }
    } catch {
      return {
        key: definition.key,
        category: definition.category,
        type: definition.type,
        description: definition.description,
        isPublic: definition.isPublic,
        value: definition.defaultValue,
        source: "default_invalid_database_value",
        updatedAt: row.updated_at,
      }
    }
  })
}

async function loadSettings(context: AdminApiContext) {
  const { data, error } = await context.supabase
    .from("app_settings")
    .select("key,value_json,value_type,category,description,is_public,updated_at")
    .order("category", { ascending: true })
    .order("key", { ascending: true })

  if (error) {
    throw error
  }

  return buildSettingsPayload((data ?? []) as SettingsRow[])
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const category = request.nextUrl.searchParams.get("category")
    const items = await loadSettings(context)
    const filtered = category ? items.filter((item) => item.category === category) : items

    return NextResponse.json({
      items: filtered,
      categories: Array.from(new Set(items.map((item) => item.category))),
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request)
    const rawBody = await request.json()
    const parsed = updateSettingSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { key, value } = parsed.data
    const definition = SETTING_DEFINITIONS_MAP.get(key)
    if (!definition) {
      return NextResponse.json({ error: "Unknown setting key" }, { status: 404 })
    }

    const normalizedValue = coerceSettingValue(definition, value)

    const { data, error } = await context.supabase
      .from("app_settings")
      .upsert({
        key,
        value_json: normalizedValue,
        value_type: definition.type,
        category: definition.category,
        description: definition.description,
        is_public: definition.isPublic,
        updated_by: context.userId,
      })
      .select("key,value_json,value_type,category,description,is_public,updated_at")
      .single()

    if (error) {
      console.error("[admin/settings] upsert_error", error)
      return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
    }

    await logAdminAudit(context, "setting.update", "app_settings", key, {
      key,
      value: normalizedValue,
    })

    return NextResponse.json({
      item: data,
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
