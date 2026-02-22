"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginPopupCard } from "@/components/login-popup-card"
import {
  DEFAULT_LOGIN_POPUP_CONFIG,
  getLoginPopupConfigFromSettings,
  type LoginPopupConfig,
} from "@/lib/admin/popup-config"

interface RuntimeConfigResponse {
  settings?: Record<string, unknown>
}

const STORAGE_PREFIX = "scrollever.login_popup_seen"

function buildSeenKey(userId: string, version: string) {
  return `${STORAGE_PREFIX}:${userId}:${version}`
}

export function PostLoginPopupGate() {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const [config, setConfig] = useState<LoginPopupConfig>(DEFAULT_LOGIN_POPUP_CONFIG)
  const [isOpen, setIsOpen] = useState(false)

  const shouldSkip = useMemo(() => {
    if (!pathname) {
      return false
    }
    return pathname.startsWith("/auth") || pathname.startsWith("/admin")
  }, [pathname])

  useEffect(() => {
    if (isLoading || !user || shouldSkip) {
      setIsOpen(false)
      return
    }

    let mounted = true
    const controller = new AbortController()

    const loadAndEvaluate = async () => {
      let nextConfig = DEFAULT_LOGIN_POPUP_CONFIG

      try {
        const response = await fetch("/api/app-config", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (response.ok) {
          const payload = (await response.json()) as RuntimeConfigResponse
          nextConfig = getLoginPopupConfigFromSettings(payload.settings)
        }
      } catch {
        // fallback config already loaded.
      }

      if (!mounted) {
        return
      }

      setConfig(nextConfig)

      if (!nextConfig.enabled) {
        setIsOpen(false)
        return
      }

      const storageKey = buildSeenKey(user.id, nextConfig.version)
      const alreadySeen = window.localStorage.getItem(storageKey) === "1"
      setIsOpen(!alreadySeen)
    }

    void loadAndEvaluate()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [isLoading, shouldSkip, user])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (user) {
      const storageKey = buildSeenKey(user.id, config.version)
      window.localStorage.setItem(storageKey, "1")
    }
    setIsOpen(false)
  }

  if (!user || shouldSkip || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" />
      <div className="relative w-full max-h-[95vh] overflow-y-auto">
        <LoginPopupCard config={config} onConfirm={handleConfirm} className="mx-auto" />
      </div>
    </div>
  )
}
