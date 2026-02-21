import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  adminApiErrorResponse,
  logAdminAudit,
  requireAdminApiContext,
} from "@/lib/admin/api-auth"

const updateProviderSchema = z.object({
  providerKey: z.string().trim().min(2).max(64),
  displayName: z.string().trim().min(2).max(100),
  apiBaseUrl: z.string().trim().url().nullable().optional(),
  apiKey: z.string().trim().min(8).max(4096).nullable().optional(),
  isEnabled: z.boolean(),
  defaultModelKey: z.string().trim().min(2).max(120).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const { data, error } = await context.supabase
      .from("ai_providers")
      .select(
        "provider_key,display_name,api_base_url,is_enabled,default_model_key,metadata,updated_at,api_key"
      )
      .order("provider_key", { ascending: true })

    if (error) {
      console.error("[admin/ai/providers] fetch_error", error)
      return NextResponse.json({ error: "Failed to load providers" }, { status: 500 })
    }

    const items = (data ?? []).map((row) => ({
      providerKey: row.provider_key,
      displayName: row.display_name,
      apiBaseUrl: row.api_base_url,
      hasApiKey: Boolean(row.api_key),
      isEnabled: Boolean(row.is_enabled),
      defaultModelKey: row.default_model_key,
      metadata: row.metadata ?? {},
      updatedAt: row.updated_at ?? null,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request)
    const rawBody = await request.json()
    const parsed = updateProviderSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const providerKey = payload.providerKey.toLowerCase().replace(/\s+/g, "-")
    const nextRecord = {
      provider_key: providerKey,
      display_name: payload.displayName,
      api_base_url: payload.apiBaseUrl ?? null,
      is_enabled: payload.isEnabled,
      default_model_key: payload.defaultModelKey ?? null,
      metadata: payload.metadata ?? {},
      updated_by: context.userId,
      ...(payload.apiKey !== undefined ? { api_key: payload.apiKey ?? null } : {}),
    }

    const { data, error } = await context.supabase
      .from("ai_providers")
      .upsert(nextRecord)
      .select(
        "provider_key,display_name,api_base_url,is_enabled,default_model_key,metadata,updated_at,api_key"
      )
      .single()

    if (error) {
      console.error("[admin/ai/providers] upsert_error", error)
      return NextResponse.json({ error: "Failed to update provider" }, { status: 500 })
    }

    await logAdminAudit(context, "ai_provider.update", "ai_providers", providerKey, {
      providerKey,
      isEnabled: payload.isEnabled,
      hasApiKey: payload.apiKey !== undefined ? Boolean(payload.apiKey) : undefined,
      defaultModelKey: payload.defaultModelKey ?? null,
    })

    return NextResponse.json({
      item: {
        providerKey: data.provider_key,
        displayName: data.display_name,
        apiBaseUrl: data.api_base_url,
        hasApiKey: Boolean(data.api_key),
        isEnabled: Boolean(data.is_enabled),
        defaultModelKey: data.default_model_key,
        metadata: data.metadata ?? {},
        updatedAt: data.updated_at ?? null,
      },
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
