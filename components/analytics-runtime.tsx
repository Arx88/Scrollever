"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  getOrCreateAnonymousId,
  getOrCreateSessionId,
  hasLandingViewed,
  hasSessionStarted,
  markLandingViewed,
  markSessionStarted,
  resolveSourceFromLocation,
  trackClientEvent,
} from "@/lib/analytics/browser"

function isTestTrafficClient() {
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
}

export function AnalyticsRuntime() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const lastPathRef = useRef<string | null>(null)
  const anonymousIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const identifiedUserRef = useRef<string | null>(null)

  const pathWithQuery = useMemo(() => {
    const query = searchParams.toString()
    if (!query) {
      return pathname
    }
    return `${pathname}?${query}`
  }, [pathname, searchParams])

  useEffect(() => {
    const anonymousId = getOrCreateAnonymousId()
    const sessionId = getOrCreateSessionId()
    anonymousIdRef.current = anonymousId
    sessionIdRef.current = sessionId

    if (!hasSessionStarted()) {
      markSessionStarted()
      void trackClientEvent({
        eventName: "session_started",
        anonymousId,
        sessionId,
        source: resolveSourceFromLocation(),
        path: pathname,
        referrer: document.referrer || null,
        isTestTraffic: isTestTrafficClient(),
      })
    }
  }, [pathname])

  useEffect(() => {
    const anonymousId = anonymousIdRef.current ?? getOrCreateAnonymousId()
    const sessionId = sessionIdRef.current ?? getOrCreateSessionId()
    anonymousIdRef.current = anonymousId
    sessionIdRef.current = sessionId

    if (lastPathRef.current === pathWithQuery) {
      return
    }
    lastPathRef.current = pathWithQuery

    void trackClientEvent({
      eventName: "page_view",
      anonymousId,
      sessionId,
      source: resolveSourceFromLocation(),
      path: pathWithQuery,
      referrer: document.referrer || null,
      metadata: {
        pathname,
      },
      isTestTraffic: isTestTrafficClient(),
    })

    if (pathname === "/" && !hasLandingViewed()) {
      markLandingViewed()
      void trackClientEvent({
        eventName: "landing_viewed",
        anonymousId,
        sessionId,
        source: resolveSourceFromLocation(),
        path: pathWithQuery,
        referrer: document.referrer || null,
        isTestTraffic: isTestTrafficClient(),
      })
    }
  }, [pathWithQuery, pathname])

  useEffect(() => {
    const anonymousId = anonymousIdRef.current
    const sessionId = sessionIdRef.current
    if (!user || !anonymousId || !sessionId) {
      return
    }

    if (identifiedUserRef.current === user.id) {
      return
    }

    identifiedUserRef.current = user.id
    void fetch("/api/analytics/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        anonymousId,
        sessionId,
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics should never block UX.
    })
  }, [user])

  return null
}
