"use client"

const ANONYMOUS_ID_STORAGE_KEY = "scrollever.analytics.anonymous_id"
const SESSION_ID_STORAGE_KEY = "scrollever.analytics.session_id"
const SESSION_STARTED_STORAGE_KEY = "scrollever.analytics.session_started"
const LANDING_VIEWED_STORAGE_KEY = "scrollever.analytics.landing_viewed"

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateAnonymousId() {
  const existing = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const next = createId()
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, next)
  return next
}

export function getOrCreateSessionId() {
  const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const next = createId()
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, next)
  return next
}

export function markSessionStarted() {
  window.sessionStorage.setItem(SESSION_STARTED_STORAGE_KEY, "1")
}

export function hasSessionStarted() {
  return window.sessionStorage.getItem(SESSION_STARTED_STORAGE_KEY) === "1"
}

export function markLandingViewed() {
  window.sessionStorage.setItem(LANDING_VIEWED_STORAGE_KEY, "1")
}

export function hasLandingViewed() {
  return window.sessionStorage.getItem(LANDING_VIEWED_STORAGE_KEY) === "1"
}

interface ClientTrackPayload {
  eventName: string
  eventId?: string
  anonymousId: string
  sessionId: string
  source?: string | null
  path?: string
  referrer?: string | null
  metadata?: Record<string, unknown>
  isTestTraffic?: boolean
}

export function resolveSourceFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const utmSource = params.get("utm_source")
  if (utmSource && utmSource.trim()) {
    return utmSource.trim().toLowerCase()
  }

  const referrer = document.referrer
  if (!referrer) {
    return "direct"
  }

  try {
    const ref = new URL(referrer)
    if (ref.hostname === window.location.hostname) {
      return "internal"
    }
    return ref.hostname
  } catch {
    return "direct"
  }
}

export async function trackClientEvent(payload: ClientTrackPayload) {
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Analytics should never block UX.
  }
}
