"use client"

import { Search, Bell, Flame, Shield, Crown, User, LogOut, Star } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useInteractions } from "@/lib/interactions-context"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, signOut } = useAuth()
  const { canSuperlike, superlikeResetTime } = useInteractions()
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)

  const isHallOfFame = pathname === "/hall-of-fame"
  const resetTime = superlikeResetTime()

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSignOut = () => {
    signOut()
    setShowUserMenu(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-background/80 backdrop-blur-2xl border-b border-border/20">
        <div className="flex items-center justify-between px-3 md:px-6 h-[56px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-xs font-extrabold">
              S
            </div>
            <span className="font-display text-foreground font-extrabold text-lg tracking-tight hidden sm:block uppercase">
              Scrollever
            </span>
          </Link>

          {/* Center: Live stats pill + Hall of Fame link */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-3 bg-surface/80 rounded-full px-4 py-1.5 border border-border/20">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-red-400" />
                <span className="text-[11px] font-mono text-foreground/70">
                  <span className="text-foreground font-bold">147</span> luchando
                </span>
              </div>
              <div className="w-px h-3 bg-border/30" />
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-mono text-foreground/70">
                  <span className="text-primary font-bold">2.4k</span> inmortales
                </span>
              </div>
            </div>

            <Link
              href="/hall-of-fame"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                isHallOfFame
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-surface/60 border-transparent text-foreground/70 hover:bg-surface hover:text-amber-400"
              }`}
            >
              <Crown className="w-3 h-3" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Hall of Fame</span>
            </Link>
          </div>

          {/* Right: Search + superlike status + auth */}
          <div className="flex items-center gap-1">
            {/* Search */}
            <div
              className={`hidden lg:flex items-center rounded-full px-3 py-1.5 gap-2 max-w-[220px] transition-all duration-300 border ${
                searchFocused
                  ? "bg-surface border-primary/30 shadow-[0_0_16px_rgba(209,254,23,0.06)]"
                  : "bg-surface/60 border-transparent"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/50 w-full"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>

            <button
              className="lg:hidden p-2 rounded-lg hover:bg-surface transition-colors"
              aria-label="Buscar"
            >
              <Search className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Hall of Fame mobile */}
            <Link
              href="/hall-of-fame"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isHallOfFame ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"
              }`}
              aria-label="Hall of Fame"
            >
              <Crown className="w-4 h-4" />
            </Link>

            {/* Superlike status pill */}
            {user && (
              <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                canSuperlike()
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-surface text-muted-foreground border border-border/20"
              }`}>
                <Star className={`w-3 h-3 ${canSuperlike() ? "fill-amber-400" : ""}`} />
                {canSuperlike() ? "1 SL" : resetTime ? `${resetTime}` : "0 SL"}
              </div>
            )}

            <button
              className="relative p-2 rounded-lg hover:bg-surface transition-colors"
              aria-label="Notificaciones"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
            </button>

            {/* Auth button / User menu */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-surface transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center ring-1 ring-primary/30">
                    <span className="text-[11px] font-bold text-primary uppercase">
                      {user.username?.[0] ?? "U"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-foreground hidden sm:block">
                    {user.username}
                  </span>
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border/30 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-border/20">
                      <p className="text-xs font-bold text-foreground">@{user.username}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold hover:shadow-[0_0_16px_rgba(209,254,23,0.2)] transition-all active:scale-95 font-display uppercase tracking-wide"
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

