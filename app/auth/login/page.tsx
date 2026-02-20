"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-sm font-extrabold">
            S
          </div>
          <span className="font-display text-foreground font-extrabold text-xl tracking-tight uppercase">
            Scrollever
          </span>
        </div>

        <h1 className="text-2xl font-display font-extrabold text-foreground uppercase tracking-tight mb-1">
          Iniciar sesion
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tu like decide quien vive y quien muere.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1.5 block">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border/30 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border/30 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-extrabold text-sm uppercase tracking-wide hover:shadow-[0_0_20px_rgba(209,254,23,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          No tenes cuenta?{" "}
          <Link href="/auth/sign-up" className="text-primary font-bold hover:underline">
            Registrate
          </Link>
        </p>
      </div>
    </main>
  )
}
