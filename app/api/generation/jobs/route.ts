import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getGenerationRuntimeSettings, getUtcDateKey } from "@/lib/generation/runtime"
import { generateImageWithProvider } from "@/lib/generation/providers"

export const runtime = "nodejs"

const JOB_ASPECT_VALUES = ["1:1", "4:5", "9:16", "16:9"] as const

const createJobSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  negativePrompt: z.string().trim().max(2000).optional().nullable(),
  modelKey: z.string().trim().min(2).max(120).optional(),
  aspectRatio: z.enum(JOB_ASPECT_VALUES).optional(),
  steps: z.number().int().min(1).max(80).optional(),
  guidance: z.number().min(1).max(30).optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
})

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 20)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20
  }
  return Math.min(100, Math.floor(parsed))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = authData.user.id
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

  const [settings, jobsRes, usageRes] = await Promise.all([
    getGenerationRuntimeSettings(supabase),
    supabase
      .from("generation_jobs")
      .select(
        "id,status,prompt,negative_prompt,provider_key,model_key,aspect_ratio,steps,guidance,seed,error_message,result_image_id,cost_credits,started_at,completed_at,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("user_generation_daily_usage")
      .select("images_generated")
      .eq("user_id", userId)
      .eq("usage_date", getUtcDateKey())
      .maybeSingle(),
  ])

  if (jobsRes.error) {
    console.error("[generation/jobs] fetch_jobs_error", jobsRes.error)
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 })
  }

  const resultImageIds = Array.from(
    new Set((jobsRes.data ?? []).map((job) => job.result_image_id).filter(Boolean))
  ) as string[]

  const imagesById = new Map<string, { id: string; url: string; created_at: string }>()
  if (resultImageIds.length > 0) {
    const { data: imageRows } = await supabase
      .from("images")
      .select("id,url,created_at")
      .in("id", resultImageIds)

    for (const row of imageRows ?? []) {
      imagesById.set(row.id, row)
    }
  }

  const usedToday = Math.max(0, Number(usageRes.data?.images_generated ?? 0))
  const dailyLimit = settings.dailyFreeLimit

  return NextResponse.json({
    enabled: settings.enabled,
    dailyFreeLimit: dailyLimit,
    usedToday,
    remainingToday: Math.max(0, dailyLimit - usedToday),
    items: (jobsRes.data ?? []).map((job) => ({
      id: job.id,
      status: job.status,
      prompt: job.prompt,
      negativePrompt: job.negative_prompt,
      providerKey: job.provider_key,
      modelKey: job.model_key,
      aspectRatio: job.aspect_ratio,
      steps: job.steps,
      guidance: job.guidance,
      seed: job.seed,
      errorMessage: job.error_message,
      costCredits: Number(job.cost_credits ?? 0),
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
      resultImage: job.result_image_id ? imagesById.get(job.result_image_id) ?? null : null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = authData.user
  const settings = await getGenerationRuntimeSettings(supabase)
  if (!settings.enabled) {
    return NextResponse.json({ error: "Generation is disabled" }, { status: 403 })
  }

  const rawBody = await request.json()
  const parsed = createJobSchema.safeParse(rawBody)

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
  const prompt = payload.prompt.trim()
  if (prompt.length > settings.maxPromptLength) {
    return NextResponse.json(
      {
        error: `Prompt too long. Max: ${settings.maxPromptLength}`,
      },
      { status: 400 }
    )
  }

  const modelKey = (payload.modelKey ?? settings.defaultModelKey).trim()
  const aspectRatio = payload.aspectRatio ?? settings.defaultAspectRatio
  const utcDate = getUtcDateKey()

  const [modelRes, usageRes] = await Promise.all([
    supabase
      .from("ai_models")
      .select("provider_key,model_key,display_name,is_enabled,is_public")
      .eq("model_key", modelKey)
      .eq("is_enabled", true)
      .eq("is_public", true)
      .maybeSingle(),
    supabase
      .from("user_generation_daily_usage")
      .select("images_generated")
      .eq("user_id", user.id)
      .eq("usage_date", utcDate)
      .maybeSingle(),
  ])

  if (modelRes.error || !modelRes.data) {
    return NextResponse.json({ error: "Model not available" }, { status: 404 })
  }

  const usedToday = Number(usageRes.data?.images_generated ?? 0)
  if (usedToday >= settings.dailyFreeLimit) {
    return NextResponse.json(
      {
        error: "Daily free limit reached",
        code: "DAILY_FREE_LIMIT_REACHED",
        dailyLimit: settings.dailyFreeLimit,
      },
      { status: 429 }
    )
  }

  const nowIso = new Date().toISOString()
  const { data: jobRow, error: createJobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      provider_key: modelRes.data.provider_key,
      model_key: modelRes.data.model_key,
      status: "running",
      prompt,
      negative_prompt: payload.negativePrompt ?? null,
      aspect_ratio: aspectRatio,
      steps: payload.steps ?? null,
      guidance: payload.guidance ?? null,
      seed: payload.seed ?? null,
      started_at: nowIso,
      metadata: {
        mocked: true,
      },
    })
    .select("id,provider_key,model_key")
    .single()

  if (createJobError || !jobRow) {
    console.error("[generation/jobs] create_job_error", createJobError)
    return NextResponse.json({ error: "Failed to create generation job" }, { status: 500 })
  }

  const generated = await generateImageWithProvider({
    providerKey: jobRow.provider_key,
    modelKey: jobRow.model_key,
    prompt,
    negativePrompt: payload.negativePrompt ?? null,
    aspectRatio,
  })

  if (generated.status !== "succeeded" || !generated.imageUrl) {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: generated.errorMessage ?? "provider_generation_failed",
        completed_at: new Date().toISOString(),
        metadata: generated.metadata,
      })
      .eq("id", jobRow.id)

    return NextResponse.json(
      {
        error: generated.errorMessage ?? "Generation failed",
      },
      { status: 500 }
    )
  }

  const { data: createdImage, error: createImageError } = await supabase
    .from("images")
    .insert({
      user_id: user.id,
      url: generated.imageUrl,
      title: prompt.slice(0, 80),
      prompt,
      category: "Editorial",
      width: generated.width ?? 900,
      height: generated.height ?? 1600,
      origin_type: "generated",
      generation_provider: jobRow.provider_key,
      generation_model: jobRow.model_key,
    })
    .select("id,url,created_at")
    .single()

  if (createImageError || !createdImage) {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: "image_creation_failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobRow.id)

    console.error("[generation/jobs] create_image_error", createImageError)
    return NextResponse.json({ error: "Failed to create generated image" }, { status: 500 })
  }

  const completedAt = new Date().toISOString()
  await Promise.all([
    supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result_image_id: createdImage.id,
        completed_at: completedAt,
        metadata: generated.metadata,
      })
      .eq("id", jobRow.id),
    supabase
      .from("user_generation_daily_usage")
      .upsert(
        {
          user_id: user.id,
          usage_date: utcDate,
          images_generated: usedToday + 1,
        },
        { onConflict: "user_id,usage_date" }
      ),
    supabase.from("credit_wallets").upsert(
      {
        user_id: user.id,
      },
      { onConflict: "user_id" }
    ),
    supabase.from("credit_ledger").insert({
      user_id: user.id,
      delta: 0,
      kind: "generation_charge",
      reference: jobRow.id,
      metadata: {
        source: "free_daily",
      },
    }),
  ])

  return NextResponse.json(
    {
      item: {
        id: jobRow.id,
        status: "succeeded",
        prompt,
        modelKey: jobRow.model_key,
        providerKey: jobRow.provider_key,
        resultImage: createdImage,
      },
      usage: {
        dailyFreeLimit: settings.dailyFreeLimit,
        usedToday: usedToday + 1,
        remainingToday: Math.max(0, settings.dailyFreeLimit - (usedToday + 1)),
      },
    },
    { status: 201 }
  )
}
