"use client"

import { Search, Crown, User, LogOut, Star, Zap, Shield } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useInteractions } from "@/lib/interactions-context"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const { user, signOut } = useAuth()
  const { canSuperlike, superlikeResetTime } = useInteractions()
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isHallOfFame = pathname === "/hall-of-fame"
  const isAdmin = user?.role === "admin" || user?.role === "owner"
  const resetTime = superlikeResetTime()
  const hasSuperlike = canSuperlike()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
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

  const handleSignOut = () => {
    signOut()
    setShowUserMenu(false)
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
                !isHallOfFame
                  ? "text-foreground bg-surface"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
              }`}
            >
              Feed
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
