import Link from "next/link"

interface AuthErrorPageProps {
  searchParams?: {
    message?: string
  }
}

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const message = searchParams?.message ?? "No se pudo completar la autenticacion. Intenta nuevamente."

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border/30 bg-card p-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-destructive font-bold mb-2">Auth error</p>
        <h1 className="text-xl font-display font-extrabold text-foreground uppercase tracking-tight mb-3">
          Error de autenticacion
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{message}</p>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide"
          >
            Ir a login
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-border/40 text-xs font-bold uppercase tracking-wide text-foreground/80"
          >
            Volver al feed
          </Link>
        </div>
      </div>
    </main>
  )
}
