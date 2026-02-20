import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function getUtcWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  return {
    dayStartIso: start.toISOString(),
    nextResetIso: end.toISOString(),
  }
}

async function getCurrentSuperlikeCount(imageId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("images")
    .select("superlike_count")
    .eq("id", imageId)
    .is("deleted_at", null)
    .single()

  if (error || !data) {
    return null
  }

  return data.superlike_count
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: imageId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: image, error: imageError } = await supabase
      .from("images")
      .select("id")
      .eq("id", imageId)
      .is("deleted_at", null)
      .maybeSingle()

    if (imageError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    const { data: duplicateSuperlike } = await supabase
      .from("superlikes")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("image_id", imageId)
      .maybeSingle()

    if (duplicateSuperlike) {
      return NextResponse.json(
        {
          error: "Ya diste superlike a esta imagen",
          code: "DUPLICATE_SUPERLIKE",
        },
        { status: 409 }
      )
    }

    const { dayStartIso, nextResetIso } = getUtcWindow()

    const { data: todaySuperlike } = await supabase
      .from("superlikes")
      .select("id,image_id,created_at")
      .eq("user_id", authData.user.id)
      .gte("created_at", dayStartIso)
      .lt("created_at", nextResetIso)
      .limit(1)

    if ((todaySuperlike ?? []).length > 0) {
      return NextResponse.json(
        {
          error: "Ya usaste tu superlike de hoy. Se renueva a las 00:00 UTC.",
          code: "DAILY_LIMIT_REACHED",
          resetAt: nextResetIso,
        },
        { status: 409 }
      )
    }

    const { error: insertError } = await supabase.from("superlikes").insert({
      user_id: authData.user.id,
      image_id: imageId,
    })

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error: "No se pudo registrar el superlike por restriccion de duplicado o limite diario.",
            code: "SUPERLIKE_CONSTRAINT",
            resetAt: nextResetIso,
          },
          { status: 409 }
        )
      }

      console.error("[api/superlike] insert_error", insertError)
      return NextResponse.json({ error: "Failed to add superlike" }, { status: 500 })
    }

    const superlikeCount = await getCurrentSuperlikeCount(imageId)

    console.info("[api/superlike] created", {
      userId: authData.user.id,
      imageId,
    })

    return NextResponse.json({
      superliked: true,
      superlikeCount,
      resetAt: nextResetIso,
    })
  } catch (error) {
    console.error("[api/superlike] unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
