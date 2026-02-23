import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

const BOT_USER_AGENT_PATTERN =
  /(bot|crawler|spider|headless|slurp|pingdom|uptime|monitor|curl|wget|python-requests)/i

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface TrackProductEventInput {
  supabase: SupabaseClient
  eventName: string
  eventId?: string | null
  eventTime?: string | Date | null
  userId?: string | null
  anonymousId?: string | null
  sessionId?: string | null
  source?: string | null
  path?: string | null
  referrer?: string | null
  metadata?: Record<string, unknown> | null
  isTestTraffic?: boolean
  request?: NextRequest
}

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function normalizeText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toIsoEventTime(value: string | Date | null | undefined) {
  if (!value) {
    return new Date().toISOString()
  }

  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString()
  }

  return date.toISOString()
}

function parseRequestIp(request: NextRequest | undefined) {
  if (!request) {
    return null
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim()
    if (firstIp) {
      return firstIp
    }
  }

  const realIp = request.headers.get("x-real-ip")
  return realIp ? realIp.trim() : null
}

function isLikelyTestTraffic(request: NextRequest | undefined, explicitFlag: boolean | undefined) {
  if (explicitFlag === true) {
    return true
  }

  if (!request) {
    return false
  }

  const host = request.headers.get("host") ?? ""
  return host.includes("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0")
}

function sanitizeMetadata(value: Record<string, unknown> | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value
}

export async function trackProductEvent(input: TrackProductEventInput) {
  const eventName = input.eventName.trim()
  if (!eventName) {
    return { ok: false, eventId: null as string | null }
  }

  const userAgent = normalizeText(input.request?.headers.get("user-agent"))
  const eventId =
    input.eventId && UUID_REGEX.test(input.eventId.trim()) ? input.eventId.trim() : createEventId()

  const insertPayload = {
    event_id: eventId,
    event_name: eventName,
    event_time: toIsoEventTime(input.eventTime),
    user_id: normalizeText(input.userId),
    anonymous_id: normalizeText(input.anonymousId),
    session_id: normalizeText(input.sessionId),
    source: normalizeText(input.source),
    path: normalizeText(input.path ?? input.request?.nextUrl.pathname ?? null),
    referrer: normalizeText(input.referrer),
    user_agent: userAgent,
    ip: normalizeText(parseRequestIp(input.request)),
    metadata: sanitizeMetadata(input.metadata),
    is_test_traffic: isLikelyTestTraffic(input.request, input.isTestTraffic),
    is_bot: BOT_USER_AGENT_PATTERN.test(userAgent ?? ""),
  }

  const { error } = await input.supabase.from("product_events").insert(insertPayload)
  if (error && error.code !== "23505") {
    console.warn("[analytics] track_event_error", {
      eventName,
      eventId,
      code: error.code,
      message: error.message,
    })
    return { ok: false, eventId }
  }

  return { ok: true, eventId }
}
