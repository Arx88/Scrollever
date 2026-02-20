import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  FEATURE_FLAG_DEFINITIONS,
  FEATURE_FLAG_DEFINITIONS_MAP,
} from "@/lib/admin/config-catalog"
import {
  adminApiErrorResponse,
  logAdminAudit,
  requireAdminApiContext,
} from "@/lib/admin/api-auth"

const updateFlagSchema = z.object({
  key: z.string().trim().min(1),
  enabled: z.boolean(),
  rollout: z.number().int().min(0).max(100).optional(),
})

interface FeatureFlagRow {
  key: string
  enabled: boolean
  rollout: number
  description: string | null
  is_public: boolean
  updated_at: string
}

function buildFlagsPayload(rows: FeatureFlagRow[]) {
  const rowMap = new Map(rows.map((row) => [row.key, row]))

  return FEATURE_FLAG_DEFINITIONS.map((definition) => {
    const row = rowMap.get(definition.key)
    return {
      key: definition.key,
      description: definition.description,
      isPublic: definition.isPublic,
      enabled: row?.enabled ?? definition.defaultEnabled,
      rollout: row?.rollout ?? definition.defaultRollout,
      source: row ? "database" : "default",
      updatedAt: row?.updated_at ?? null,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })

    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("key,enabled,rollout,description,is_public,updated_at")
      .order("key", { ascending: true })

    if (error) {
      console.error("[admin/feature-flags] fetch_error", error)
      return NextResponse.json({ error: "Failed to load feature flags" }, { status: 500 })
    }

    return NextResponse.json({
      items: buildFlagsPayload((data ?? []) as FeatureFlagRow[]),
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request)
    const rawBody = await request.json()
    const parsed = updateFlagSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { key, enabled } = parsed.data
    const definition = FEATURE_FLAG_DEFINITIONS_MAP.get(key)
    if (!definition) {
      return NextResponse.json({ error: "Unknown feature flag key" }, { status: 404 })
    }

    const rollout = parsed.data.rollout ?? definition.defaultRollout

    const { data, error } = await context.supabase
      .from("feature_flags")
      .upsert({
        key,
        enabled,
        rollout,
        description: definition.description,
        is_public: definition.isPublic,
        updated_by: context.userId,
      })
      .select("key,enabled,rollout,description,is_public,updated_at")
      .single()

    if (error) {
      console.error("[admin/feature-flags] upsert_error", error)
      return NextResponse.json({ error: "Failed to update feature flag" }, { status: 500 })
    }

    await logAdminAudit(context, "feature_flag.update", "feature_flags", key, {
      key,
      enabled,
      rollout,
    })

    return NextResponse.json({
      item: data,
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
