"use client"

import { Search, Crown, User, LogOut, Star, Zap, Shield, Wand2, FolderHeart, Bell } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useInteractions } from "@/lib/interactions-context"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

interface HeaderNotification {
  id: string
  kind: string
  title: string
  body: string
  ctaPath: string | null
  isRead: boolean
  createdAt: string
}

function formatRelativeTime(isoDate: string) {
  const parsed = Date.parse(isoDate)
  if (!Number.isFinite(parsed)) {
    return ""
  }

  const diffMs = Date.now() - parsed
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) {
    return "Ahora"
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false)
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { user, signOut } = useAuth()
  const { canSuperlike, superlikeResetTime } = useInteractions()
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isHallOfFame = pathname === "/hall-of-fame"
  const isCreate = pathname === "/create"
  const isBoards = pathname === "/boards" || pathname.startsWith("/boards/")
  const isAdmin = user?.role === "admin" || user?.role === "owner"
  const resetTime = superlikeResetTime()
  const hasSuperlike = canSuperlike()

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (!user) {
        setNotifications([])
        setUnreadNotifications(0)
        setNotificationsError(null)
        setShowNotificationsMenu(false)
        return
      }

      if (!silent) {
        setNotificationsLoading(true)
      }

      try {
        const response = await fetch("/api/notifications?limit=12", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("notifications_request_failed")
        }

        const payload = (await response.json()) as {
          items: HeaderNotification[]
          unreadCount: number
        }

        setNotifications(payload.items ?? [])
        setUnreadNotifications(typeof payload.unreadCount === "number" ? payload.unreadCount : 0)
        setNotificationsError(null)
      } catch {
        if (!silent) {
          setNotificationsError("No se pudieron cargar notificaciones")
        }
      } finally {
        if (!silent) {
          setNotificationsLoading(false)
        }
      }
    },
    [user]
  )

  const markNotificationAsRead = useCallback(
    async (notification: HeaderNotification) => {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mark_read",
            id: notification.id,
          }),
        })

        if (!response.ok) {
          throw new Error("mark_notification_failed")
        }

        const payload = (await response.json()) as { unreadCount?: number }
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  isRead: true,
                }
              : item
          )
        )
        if (typeof payload.unreadCount === "number") {
          setUnreadNotifications(payload.unreadCount)
        }
      } catch {
        // Keep UX non-blocking for notification actions.
      }

      if (notification.ctaPath) {
        router.push(notification.ctaPath)
      }
    },
    [router]
  )

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_all_read",
        }),
      })

      if (!response.ok) {
        throw new Error("mark_all_failed")
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setUnreadNotifications(0)
    } catch {
      // Keep UX non-blocking for notification actions.
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotificationsMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadNotifications(true)
    }, 45_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadNotifications, user])

  const handleSignOut = () => {
    signOut()
    setShowUserMenu(false)
    setShowNotificationsMenu(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-background/90 backdrop-blur-2xl border-b border-border/10">
        <div className="flex items-center justify-between px-3 md:px-5 h-[56px]">

          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-xs font-extrabold">
              S
            </div>
            <span className="font-display text-foreground font-extrabold text-lg tracking-tight hidden sm:block uppercase">
              Scrollever
            </span>
          </Link>

          {/* Center: Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                !isHallOfFame && !isCreate && !isBoards
                  ? "text-foreground bg-surface"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
              }`}
            >
              Feed
            </Link>
            <Link
              href="/create"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                isCreate
                  ? "text-foreground bg-surface"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
              }`}
            >
              <Wand2 className="w-3 h-3" />
              Create
            </Link>
            <Link
              href="/boards"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                isBoards
                  ? "text-foreground bg-surface"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
              }`}
            >
              <FolderHeart className="w-3 h-3" />
              Boards
            </Link>
            <Link
              href="/hall-of-fame"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                isHallOfFame
                  ? "text-amber-400 bg-amber-500/10"
                  : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/5"
              }`}
            >
              <Crown className="w-3 h-3" />
              Top 10
            </Link>
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-2">

            {/* Search toggle */}
            {showSearch ? (
              <div className="flex items-center gap-2 bg-surface border border-border/30 rounded-lg px-3 py-1.5 animate-fade-in-up">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/40 w-28 md:w-40"
                  onBlur={() => setShowSearch(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {user && (
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => {
                    setShowNotificationsMenu((prev) => !prev)
                    if (!showNotificationsMenu) {
                      void loadNotifications()
                    }
                  }}
                  className="relative p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Notificaciones"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                      {Math.min(unreadNotifications, 99)}
                    </span>
                  )}
                </button>

                {showNotificationsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-20px)] bg-card border border-border/20 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-3 py-2.5 border-b border-border/10 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
                          Notificaciones
                        </p>
                        <p className="text-[11px] text-foreground font-bold">
                          {unreadNotifications} sin leer
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsAsRead()}
                        className="text-[10px] uppercase tracking-[0.12em] font-bold text-primary hover:text-primary/80"
                        disabled={unreadNotifications === 0}
                      >
                        Marcar todas
                      </button>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {notificationsLoading ? (
                        <div className="p-3 space-y-2">
                          <div className="h-16 rounded-lg bg-surface animate-pulse" />
                          <div className="h-16 rounded-lg bg-surface animate-pulse" />
                        </div>
                      ) : notificationsError ? (
                        <p className="px-3 py-4 text-xs text-destructive font-bold">{notificationsError}</p>
                      ) : notifications.length === 0 ? (
                        <p className="px-3 py-5 text-xs text-muted-foreground">Todavia no hay novedades para mostrar.</p>
                      ) : (
                        <div className="p-2 space-y-2">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => void markNotificationAsRead(notification)}
                              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                notification.isRead
                                  ? "border-border/15 bg-background/30 hover:bg-background/50"
                                  : "border-primary/20 bg-primary/10 hover:bg-primary/15"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-bold text-foreground">{notification.title}</p>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                                {notification.body}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Superlike status - prominent when available */}
            {user && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                hasSuperlike
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15"
                  : "bg-surface/60 text-muted-foreground border border-border/10"
              }`}>
                <Zap className={`w-3 h-3 ${hasSuperlike ? "text-amber-400" : "text-muted-foreground/60"}`} />
                <span className="hidden sm:inline">
                  {hasSuperlike ? "1 Superlike" : resetTime ? resetTime : "Usado"}
                </span>
                <span className="sm:hidden">
                  {hasSuperlike ? "1" : "0"}
                </span>
              </div>
            )}

            {/* Hall of Fame mobile */}
            <Link
              href="/create"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isCreate ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
              }`}
              aria-label="Create"
            >
              <Wand2 className="w-4 h-4" />
            </Link>

            <Link
              href="/boards"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isBoards ? "text-foreground bg-surface" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Boards"
            >
              <FolderHeart className="w-4 h-4" />
            </Link>

            <Link
              href="/hall-of-fame"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isHallOfFame ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground hover:text-amber-400"
              }`}
              aria-label="Top 10"
            >
              <Crown className="w-4 h-4" />
            </Link>

            {/* Auth */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                    <span className="text-[11px] font-bold text-primary uppercase">
                      {user.username?.[0] ?? "U"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-foreground hidden md:block">
                    {user.username}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border/20 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-4 border-b border-border/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">@{user.username}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Superlike status in dropdown */}
                    <div className="p-3 border-b border-border/10">
                      <div className={`flex items-center gap-2.5 p-2.5 rounded-lg ${
                        hasSuperlike ? "bg-amber-500/10" : "bg-surface"
                      }`}>
                        <Star className={`w-4 h-4 ${hasSuperlike ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                        <div>
                          <p className={`text-[11px] font-bold ${hasSuperlike ? "text-amber-400" : "text-muted-foreground"}`}>
                            {hasSuperlike ? "Superlike disponible" : "Superlike usado"}
                          </p>
                          {!hasSuperlike && resetTime && (
                            <p className="text-[10px] text-muted-foreground">
                              Se renueva en {resetTime}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5">
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-foreground hover:bg-surface transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Panel admin
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Cerrar sesion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/login")}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold hover:shadow-[0_0_20px_rgba(209,254,23,0.2)] transition-all active:scale-95 font-display uppercase tracking-wider"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
