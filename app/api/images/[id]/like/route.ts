import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logVoteRejection } from "@/lib/vote-audit"
import { notifyLikeMilestone, resolveLikeMilestone } from "@/lib/notifications/service"
import { trackProductEvent } from "@/lib/analytics/track-event"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function isSelfVoteError(error: { message?: string | null; details?: string | null }) {
  const fullMessage = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()
  return fullMessage.includes("self-vote") || fullMessage.includes("self vote")
}

async function getCurrentLikeCount(imageId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("images")
    .select("like_count")
    .eq("id", imageId)
    .is("deleted_at", null)
    .single()

  if (error || !data) {
    return null
  }

  return data.like_count
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
      logVoteRejection(authData.user.id, "likes", imageId, "IMAGE_EXPIRED", request)
      return NextResponse.json(
        {
          error: "Esta imagen ya no acepta votos.",
          code: "IMAGE_EXPIRED",
        },
        { status: 410 }
      )
    }

    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("image_id", imageId)
      .maybeSingle()

    let liked = true

    if (existingLike) {
      liked = false
      const { error: deleteError } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("image_id", imageId)

      if (deleteError) {
        console.error("[api/like] delete_error", deleteError)
        return NextResponse.json({ error: "Failed to remove like" }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase.from("likes").insert({
        user_id: authData.user.id,
        image_id: imageId,
      })

      if (insertError) {
        if (isSelfVoteError(insertError)) {
          logVoteRejection(authData.user.id, "likes", imageId, "SELF_VOTE", request)
          return NextResponse.json(
            {
              error: "No podes votar tu propia imagen.",
              code: "SELF_VOTE",
            },
            { status: 403 }
          )
        }

        console.error("[api/like] insert_error", insertError)
        return NextResponse.json({ error: "Failed to add like" }, { status: 500 })
      }
    }

    const likeCount = await getCurrentLikeCount(imageId)

    if (liked && likeCount !== null && image.user_id !== authData.user.id) {
      const milestone = resolveLikeMilestone(likeCount)
      if (milestone) {
        void notifyLikeMilestone({
          ownerUserId: image.user_id,
          imageId,
          milestone,
        })
      }
    }

    if (liked) {
      void trackProductEvent({
        supabase,
        request,
        eventName: "like_added",
        userId: authData.user.id,
        source: "feed",
        path: request.nextUrl.pathname,
        metadata: {
          imageId,
          ownerUserId: image.user_id,
          likeCount,
        },
      })
    }

    console.info("[api/like] toggled", {
      userId: authData.user.id,
      imageId,
      liked,
    })

    return NextResponse.json({
      liked,
      likeCount,
    })
  } catch (error) {
    console.error("[api/like] unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", authData.user.id)
      .eq("image_id", imageId)

    if (error) {
      console.error("[api/like] delete_error", error)
      return NextResponse.json({ error: "Failed to remove like" }, { status: 500 })
    }

    const likeCount = await getCurrentLikeCount(imageId)

    return NextResponse.json({
      liked: false,
      likeCount,
    })
  } catch (error) {
    console.error("[api/like] delete_unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
