import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGenerationRuntimeSettings } from "@/lib/generation/runtime"

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      enabled: false,
      defaultModelKey: "gpt-image-1",
      defaultAspectRatio: "9:16",
      dailyFreeLimit: 5,
      models: [],
    })
  }

  try {
    const supabase = await createClient()
    const settings = await getGenerationRuntimeSettings(supabase)
    const { data, error } = await supabase
      .from("ai_models")
      .select(
        "provider_key,model_key,display_name,description,supports_image_to_image,supports_inpainting,supports_controlnet,max_resolution,is_enabled,is_public,sort_order"
      )
      .eq("is_enabled", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true })

    if (error) {
      console.error("[generation/models] fetch_error", error)
      return NextResponse.json({ error: "Failed to load models" }, { status: 500 })
    }

    return NextResponse.json({
      enabled: settings.enabled,
      defaultModelKey: settings.defaultModelKey,
      defaultAspectRatio: settings.defaultAspectRatio,
      dailyFreeLimit: settings.dailyFreeLimit,
      models: (data ?? []).map((item) => ({
        providerKey: item.provider_key,
        modelKey: item.model_key,
        displayName: item.display_name,
        description: item.description,
        supportsImageToImage: Boolean(item.supports_image_to_image),
        supportsInpainting: Boolean(item.supports_inpainting),
        supportsControlnet: Boolean(item.supports_controlnet),
        maxResolution: Number(item.max_resolution ?? 2048),
      })),
    })
  } catch (error) {
    console.error("[generation/models] unexpected_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
