import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { trackProductEvent } from "@/lib/analytics/track-event"

export const runtime = "nodejs"

const trackEventSchema = z.object({
  eventName: z.string().trim().min(1).max(80),
  eventId: z.string().uuid().optional(),
  eventTime: z.string().datetime().optional(),
  anonymousId: z.string().trim().min(8).max(200).optional(),
  sessionId: z.string().trim().min(8).max(200).optional(),
  source: z.string().trim().max(120).optional().nullable(),
  path: z.string().trim().max(500).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isTestTraffic: z.boolean().optional(),
})

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const payload = trackEventSchema.parse(await request.json())
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()

    const result = await trackProductEvent({
      supabase,
      request,
      eventName: payload.eventName,
      eventId: payload.eventId,
      eventTime: payload.eventTime,
      userId: authData.user?.id ?? null,
      anonymousId: payload.anonymousId ?? null,
      sessionId: payload.sessionId ?? null,
      source: payload.source ?? null,
      path: payload.path ?? request.nextUrl.pathname,
      referrer: payload.referrer ?? request.headers.get("referer"),
      metadata: payload.metadata ?? {},
      isTestTraffic: payload.isTestTraffic,
    })

    return NextResponse.json(
      {
        ok: result.ok,
        eventId: result.eventId,
      },
      { status: 202 }
    )
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

    console.error("[analytics/events] unhandled_error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
