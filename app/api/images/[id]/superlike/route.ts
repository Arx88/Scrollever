import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logVoteRejection } from "@/lib/vote-audit"
import { notifySuperlikeReceived } from "@/lib/notifications/service"
import { trackProductEvent } from "@/lib/analytics/track-event"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface SuperlikeSettings {
  dailyLimit: number
  resetTimezone: string
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function isSelfVoteError(error: { message?: string | null; details?: string | null }) {
  const fullMessage = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()
  return fullMessage.includes("self-vote") || fullMessage.includes("self vote")
}

function getUtcWindow(now = new Date(), resetTimezone = "UTC") {
  if (resetTimezone.toUpperCase() !== "UTC") {
    console.warn("[api/superlike] unsupported_reset_timezone_fallback", { resetTimezone })
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))

  return {
    dayStartIso: start.toISOString(),
    nextResetIso: end.toISOString(),
  }
}

function parseSettingNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

async function loadSuperlikeSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SuperlikeSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("key,value_json")
    .in("key", ["superlike.daily_limit", "superlike.reset_timezone"])

  const rows = data ?? []
  const byKey = new Map(rows.map((row) => [row.key, row.value_json]))

  const dailyLimitValue = parseSettingNumber(byKey.get("superlike.daily_limit"), 1)
  const dailyLimit = Math.max(1, Math.min(50, Math.floor(dailyLimitValue)))

  const resetTimezoneRaw = byKey.get("superlike.reset_timezone")
  const resetTimezone =
    typeof resetTimezoneRaw === "string" && resetTimezoneRaw.trim().length > 0
      ? resetTimezoneRaw.trim()
      : "UTC"

  return { dailyLimit, resetTimezone }
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

export async function POST(request: NextRequest, context: RouteContext) {
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

    const superlikeSettings = await loadSuperlikeSettings(supabase)

    const { data: image, error: imageError } = await supabase
      .from("images")
      .select("id,user_id,expires_at,is_immortal")
      .eq("id", imageId)
      .is("deleted_at", null)
      .maybeSingle()

    if (imageError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    const expiresAtMs = Date.parse(image.expires_at)
    if (!image.is_immortal && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      logVoteRejection(authData.user.id, "superlikes", imageId, "IMAGE_EXPIRED", request)
      return NextResponse.json(
        {
          error: "Esta imagen ya no acepta votos.",
          code: "IMAGE_EXPIRED",
        },
        { status: 410 }
      )
    }

    const { data: duplicateSuperlike } = await supabase
      .from("superlikes")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("image_id", imageId)
      .maybeSingle()

    if (duplicateSuperlike) {
      logVoteRejection(authData.user.id, "superlikes", imageId, "DUPLICATE_SUPERLIKE", request)
      return NextResponse.json(
        {
          error: "Ya diste superlike a esta imagen",
          code: "DUPLICATE_SUPERLIKE",
        },
        { status: 409 }
      )
    }

    const { dayStartIso, nextResetIso } = getUtcWindow(new Date(), superlikeSettings.resetTimezone)

    const { count: todaySuperlikeCount, error: countError } = await supabase
      .from("superlikes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id)
      .gte("created_at", dayStartIso)
      .lt("created_at", nextResetIso)

    if (countError) {
      console.error("[api/superlike] count_error", countError)
      return NextResponse.json({ error: "Failed to validate daily superlike limit" }, { status: 500 })
    }

    if ((todaySuperlikeCount ?? 0) >= superlikeSettings.dailyLimit) {
      logVoteRejection(authData.user.id, "superlikes", imageId, "DAILY_LIMIT_REACHED", request)
      const limitLabel =
        superlikeSettings.dailyLimit === 1
          ? "tu superlike de hoy"
          : `tus ${superlikeSettings.dailyLimit} superlikes de hoy`

      return NextResponse.json(
        {
          error: `Ya usaste ${limitLabel}. Se renuevan a las 00:00 UTC.`,
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
      if (isSelfVoteError(insertError)) {
        logVoteRejection(authData.user.id, "superlikes", imageId, "SELF_VOTE", request)
        return NextResponse.json(
          {
            error: "No podes votar tu propia imagen.",
            code: "SELF_VOTE",
          },
          { status: 403 }
        )
      }

      if (insertError.code === "23505") {
        logVoteRejection(authData.user.id, "superlikes", imageId, "SUPERLIKE_CONSTRAINT", request)
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

    if (image.user_id !== authData.user.id) {
      void notifySuperlikeReceived({
        ownerUserId: image.user_id,
        imageId,
        superlikeCount,
      })
    }

    void trackProductEvent({
      supabase,
      request,
      eventName: "superlike_added",
      userId: authData.user.id,
      source: "feed",
      path: request.nextUrl.pathname,
      metadata: {
        imageId,
        ownerUserId: image.user_id,
        superlikeCount,
      },
    })

    console.info("[api/superlike] created", {
      userId: authData.user.id,
      imageId,
      dailyLimit: superlikeSettings.dailyLimit,
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
