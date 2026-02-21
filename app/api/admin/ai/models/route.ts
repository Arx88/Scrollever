import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  adminApiErrorResponse,
  logAdminAudit,
  requireAdminApiContext,
} from "@/lib/admin/api-auth"

const updateModelSchema = z.object({
  providerKey: z.string().trim().min(2).max(64),
  modelKey: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  isEnabled: z.boolean(),
  isPublic: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  maxResolution: z.number().int().min(128).max(8192).default(2048),
  supportsImageToImage: z.boolean().default(false),
  supportsInpainting: z.boolean().default(false),
  supportsControlnet: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const provider = request.nextUrl.searchParams.get("provider")

    let query = context.supabase
      .from("ai_models")
      .select(
        "id,provider_key,model_key,display_name,description,is_enabled,is_public,sort_order,max_resolution,supports_image_to_image,supports_inpainting,supports_controlnet,metadata,updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true })

    if (provider) {
      query = query.eq("provider_key", provider)
    }

    const { data, error } = await query

    if (error) {
      console.error("[admin/ai/models] fetch_error", error)
      return NextResponse.json({ error: "Failed to load models" }, { status: 500 })
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      providerKey: row.provider_key,
      modelKey: row.model_key,
      displayName: row.display_name,
      description: row.description,
      isEnabled: Boolean(row.is_enabled),
      isPublic: Boolean(row.is_public),
      sortOrder: Number(row.sort_order ?? 0),
      maxResolution: Number(row.max_resolution ?? 2048),
      supportsImageToImage: Boolean(row.supports_image_to_image),
      supportsInpainting: Boolean(row.supports_inpainting),
      supportsControlnet: Boolean(row.supports_controlnet),
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
    const parsed = updateModelSchema.safeParse(rawBody)

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
    const modelKey = payload.modelKey.toLowerCase().replace(/\s+/g, "-")
    const providerKey = payload.providerKey.toLowerCase().replace(/\s+/g, "-")

    const nextRecord = {
      provider_key: providerKey,
      model_key: modelKey,
      display_name: payload.displayName,
      description: payload.description ?? null,
      is_enabled: payload.isEnabled,
      is_public: payload.isPublic,
      sort_order: payload.sortOrder,
      max_resolution: payload.maxResolution,
      supports_image_to_image: payload.supportsImageToImage,
      supports_inpainting: payload.supportsInpainting,
      supports_controlnet: payload.supportsControlnet,
      metadata: payload.metadata ?? {},
      updated_by: context.userId,
    }

    const { data, error } = await context.supabase
      .from("ai_models")
      .upsert(nextRecord, { onConflict: "model_key" })
      .select(
        "id,provider_key,model_key,display_name,description,is_enabled,is_public,sort_order,max_resolution,supports_image_to_image,supports_inpainting,supports_controlnet,metadata,updated_at"
      )
      .single()

    if (error) {
      console.error("[admin/ai/models] upsert_error", error)
      return NextResponse.json({ error: "Failed to update model" }, { status: 500 })
    }

    await logAdminAudit(context, "ai_model.update", "ai_models", modelKey, {
      modelKey,
      providerKey,
      isEnabled: payload.isEnabled,
      isPublic: payload.isPublic,
    })

    return NextResponse.json({
      item: {
        id: data.id,
        providerKey: data.provider_key,
        modelKey: data.model_key,
        displayName: data.display_name,
        description: data.description,
        isEnabled: Boolean(data.is_enabled),
        isPublic: Boolean(data.is_public),
        sortOrder: Number(data.sort_order ?? 0),
        maxResolution: Number(data.max_resolution ?? 2048),
        supportsImageToImage: Boolean(data.supports_image_to_image),
        supportsInpainting: Boolean(data.supports_inpainting),
        supportsControlnet: Boolean(data.supports_controlnet),
        metadata: data.metadata ?? {},
        updatedAt: data.updated_at ?? null,
      },
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
