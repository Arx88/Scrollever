import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { trackProductEvent } from "@/lib/analytics/track-event"

export const runtime = "nodejs"

const identifySchema = z.object({
  anonymousId: z.string().trim().min(8).max(200),
  sessionId: z.string().trim().min(8).max(200).optional(),
})

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const payload = identifySchema.parse(await request.json())
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error: linkError } = await supabase.from("identity_links").upsert(
      {
        anonymous_id: payload.anonymousId,
        user_id: authData.user.id,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "anonymous_id,user_id" }
    )

    if (linkError) {
      console.error("[analytics/identify] identity_link_error", linkError)
      return NextResponse.json({ error: "Failed to link identity" }, { status: 500 })
    }

    await trackProductEvent({
      supabase,
      request,
      eventName: "identity_linked",
      userId: authData.user.id,
      anonymousId: payload.anonymousId,
      sessionId: payload.sessionId ?? null,
      source: "identity",
      path: request.nextUrl.pathname,
      metadata: {
        linkedBy: "api_identify",
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: error.flatten(),
        },
        { status: 400 }
      )
    }

    console.error("[analytics/identify] unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
