"use client"

import { useEffect, useState } from "react"
import { Activity, Crown, Image as ImageIcon, Sparkles, Users } from "lucide-react"

interface AdminStats {
  usersTotal: number
  imagesActive: number
  imagesPending: number
  immortalImages: number
  hallOfFameImages: number
  likes24h: number
  superlikes24h: number
}

const defaultStats: AdminStats = {
  usersTotal: 0,
  imagesActive: 0,
  imagesPending: 0,
  immortalImages: 0,
  hallOfFameImages: 0,
  likes24h: 0,
  superlikes24h: 0,
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadStats = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/stats", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("stats_request_failed")
        }

        const payload = (await response.json()) as AdminStats
        if (!mounted) {
          return
        }

        setStats(payload)
      } catch {
        if (mounted) {
          setError("No se pudo cargar el dashboard")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadStats()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10">
          <p className="text-xs font-bold text-destructive uppercase tracking-wider">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Usuarios"
          value={stats.usersTotal}
          loading={loading}
          icon={<Users className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Imagenes activas"
          value={stats.imagesActive}
          loading={loading}
          icon={<ImageIcon className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Inmortales"
          value={stats.immortalImages}
          loading={loading}
          icon={<Sparkles className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Hall of Fame"
          value={stats.hallOfFameImages}
          loading={loading}
          icon={<Crown className="w-4 h-4 text-amber-400" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          label="Pendientes de supervivencia"
          value={stats.imagesPending}
          loading={loading}
          icon={<Activity className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Likes en 24h"
          value={stats.likes24h}
          loading={loading}
          icon={<Activity className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          label="Superlikes en 24h"
          value={stats.superlikes24h}
          loading={loading}
          icon={<Crown className="w-4 h-4 text-amber-400" />}
        />
      </div>
    </section>
  )
}

function MetricCard(props: {
  label: string
  value: number
  loading: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/20 bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">{props.label}</p>
        {props.icon}
      </div>
      {props.loading ? (
        <div className="h-8 w-20 rounded bg-surface animate-pulse" />
      ) : (
        <p className="text-2xl font-mono font-bold text-foreground">{props.value.toLocaleString()}</p>
      )}
    </div>
  )
}
