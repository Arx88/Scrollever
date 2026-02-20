"use client"

import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

export default function SignUpSuccessPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-sm font-extrabold">
            S
          </div>
          <span className="font-display text-foreground font-extrabold text-xl tracking-tight uppercase">
            Scrollever
          </span>
        </div>

        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Check className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-2xl font-display font-extrabold text-foreground uppercase tracking-tight mb-2">
          Cuenta creada
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Ya sos parte de SCROLLEVER. Ahora podes dar likes, usar tu superlike diario y luchar por el Hall of Fame.
        </p>

        <button
          onClick={() => router.push("/")}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-extrabold text-sm uppercase tracking-wide hover:shadow-[0_0_20px_rgba(209,254,23,0.2)] transition-all active:scale-[0.98]"
        >
          Empezar a scrollear
        </button>
      </div>
    </main>
  )
}
