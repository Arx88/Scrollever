"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, ArrowLeft, Zap } from "lucide-react"

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === "login") {
        const result = await signIn(email, password)
        if (result.error) {
          setError(result.error)
        } else {
          router.push("/")
        }
      } else {
        if (!username.trim()) {
          setError("El nombre de usuario es obligatorio")
          setLoading(false)
          return
        }
        const result = await signUp(email, password, username)
        if (result.error) {
          setError(result.error)
        } else {
          setSignupSuccess(true)
        }
      }
    } catch {
      setError("Ocurrio un error inesperado")
    } finally {
      setLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-extrabold text-foreground uppercase tracking-tight mb-3">
            Revisa tu correo
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Te enviamos un enlace de confirmacion a <span className="text-foreground font-bold">{email}</span>. Confirma tu cuenta para empezar a votar.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:shadow-[0_0_24px_rgba(209,254,23,0.25)] transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al feed
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - visual */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <Image
          src="/provisional/img-9.jpg"
          alt="SCROLLEVER featured art"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-12">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-sm font-extrabold">
              S
            </div>
            <span className="font-display text-foreground font-extrabold text-xl tracking-tight uppercase">
              Scrollever
            </span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-display font-extrabold text-foreground uppercase tracking-tight leading-[1.1] mb-5 text-balance max-w-lg">
            Donde las imagenes luchan por sobrevivir
          </h2>
          <p className="text-sm text-foreground/60 leading-relaxed max-w-md">
            Cada imagen tiene 24 horas. Tu voto decide quien vive y quien muere. Las mejores se vuelven inmortales.
          </p>

          <div className="flex items-center gap-8 mt-10">
            <div>
              <span className="text-3xl font-mono font-bold text-primary">2.4k</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-[0.15em] mt-1">Inmortales</span>
            </div>
            <div className="w-px h-10 bg-foreground/10" />
            <div>
              <span className="text-3xl font-mono font-bold text-foreground">147</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-[0.15em] mt-1">Luchando ahora</span>
            </div>
            <div className="w-px h-10 bg-foreground/10" />
            <div>
              <span className="text-3xl font-mono font-bold text-amber-400">1</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-[0.15em] mt-1">Superlike / dia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-16">
        <div className="w-full max-w-[380px]">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al feed
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-sm font-extrabold">
              S
            </div>
            <span className="font-display text-foreground font-extrabold text-xl tracking-tight uppercase">
              Scrollever
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground uppercase tracking-tight mb-2">
            {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            {mode === "login"
              ? "Inicia sesion para votar y decidir que imagenes sobreviven."
              : "Unite a la comunidad. 1 superlike por dia. Poder infinito."
            }
          </p>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border/20 mb-8">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null) }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                mode === "login"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null) }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {mode === "signup" && (
              <div>
                <label htmlFor="username" className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2">
                  Nombre de usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu_nombre"
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-border/30 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border/30 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2">
                Contrasena
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-surface border border-border/30 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-display font-extrabold text-sm uppercase tracking-wider hover:shadow-[0_0_32px_rgba(209,254,23,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading
                ? "Cargando..."
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"
              }
            </button>
          </form>

          {/* Superlike teaser */}
          <div className="mt-10 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Superlike diario
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Cada usuario tiene 1 superlike por dia. Es tu voto de poder para consagrar imagenes en el Hall of Fame.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
