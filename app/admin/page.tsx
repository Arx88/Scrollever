"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import {
  Activity,
  BellRing,
  ChartColumnIncreasing,
  Crown,
  Gauge,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react"

type HealthTone = "good" | "warn" | "critical"

interface DashboardPayload {
  generatedAt: string
  kpis: {
    usersTotal: number
    activeCreators24h: number
    imagesActive: number
    imagesPending: number
    immortalImages: number
    hallOfFameImages: number
    likes24h: number
    superlikes24h: number
    boardSaves24h: number
    notifications24h: number
    notificationsUnread: number
    jobsStarted24h: number
    jobsSucceeded24h: number
    jobsFailed24h: number
    jobsCancelled24h: number
    jobsSuccessRate24h: number
    averageGenerationMinutes24h: number
    generatedImages24h: number
    avgLikesPerGenerated24h: number
    avgSuperlikesPerGenerated24h: number
    immortalizedGenerated24h: number
    likesNeededMedian: number
    competitionLiveCount: number
    competitionEdgeCount: number
    closedCohorts24h: number
    survivedClosed24h: number
    survivalRateClosed24h: number
    visitors24h: number
    visitors7d: number
    sessions24h: number
    sessions7d: number
    qualifiedVisitors24h: number
    signupCompleted24h: number
    signupConversion24h: number
    retentionD1Pct: number
    retentionD7Pct: number
    retentionD30Pct: number
    dau: number
    mau: number
    stickinessPct: number
    signupProfiles24h: number
    signupTrackingCoveragePct: number
  }
  funnel: Array<{
    id: string
    label: string
    value: number
  }>
  healthSignals: Array<{
    id: string
    label: string
    value: string
    description: string
    tone: HealthTone
  }>
  topCreators: Array<{
    position: number
    userId: string
    username: string
    imagesGenerated24h: number
    likesReceived24h: number
    superlikesReceived24h: number
    immortalized24h: number
  }>
  topSources: Array<{
    source: string
    sessions: number
    sharePct: number
  }>
}

const defaultPayload: DashboardPayload = {
  generatedAt: "",
  kpis: {
    usersTotal: 0,
    activeCreators24h: 0,
    imagesActive: 0,
    imagesPending: 0,
    immortalImages: 0,
    hallOfFameImages: 0,
    likes24h: 0,
    superlikes24h: 0,
    boardSaves24h: 0,
    notifications24h: 0,
    notificationsUnread: 0,
    jobsStarted24h: 0,
    jobsSucceeded24h: 0,
    jobsFailed24h: 0,
    jobsCancelled24h: 0,
    jobsSuccessRate24h: 0,
    averageGenerationMinutes24h: 0,
    generatedImages24h: 0,
    avgLikesPerGenerated24h: 0,
    avgSuperlikesPerGenerated24h: 0,
    immortalizedGenerated24h: 0,
    likesNeededMedian: 0,
    competitionLiveCount: 0,
    competitionEdgeCount: 0,
    closedCohorts24h: 0,
    survivedClosed24h: 0,
    survivalRateClosed24h: 0,
    visitors24h: 0,
    visitors7d: 0,
    sessions24h: 0,
    sessions7d: 0,
    qualifiedVisitors24h: 0,
    signupCompleted24h: 0,
    signupConversion24h: 0,
    retentionD1Pct: 0,
    retentionD7Pct: 0,
    retentionD30Pct: 0,
    dau: 0,
    mau: 0,
    stickinessPct: 0,
    signupProfiles24h: 0,
    signupTrackingCoveragePct: 0,
  },
  funnel: [],
  healthSignals: [],
  topCreators: [],
  topSources: [],
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function toneClass(tone: HealthTone) {
  if (tone === "good") {
    return "border-primary/30 bg-primary/10 text-primary"
  }
  if (tone === "warn") {
    return "border-amber-500/40 bg-amber-500/12 text-amber-300"
  }
  return "border-destructive/40 bg-destructive/12 text-destructive"
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardPayload>(defaultPayload)
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

        const payload = (await response.json()) as DashboardPayload
        if (!mounted) {
          return
        }

        setDashboard(payload)
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

  const funnelMax = useMemo(() => {
    const values = dashboard.funnel.map((item) => item.value)
    return values.length > 0 ? Math.max(...values, 1) : 1
  }, [dashboard.funnel])

  const kpiCards: Array<{
    id: string
    label: string
    value: number
    helper: string
    icon: ComponentType<{ className?: string }>
    suffix?: string
  }> = [
    {
      id: "visitors_24h",
      label: "Visitantes unicos (24h)",
      value: dashboard.kpis.visitors24h,
      helper: `${formatCompact(dashboard.kpis.visitors7d)} en 7 dias`,
      icon: Users,
    },
    {
      id: "sessions_24h",
      label: "Sesiones (24h)",
      value: dashboard.kpis.sessions24h,
      helper: `${formatCompact(dashboard.kpis.sessions7d)} en 7 dias`,
      icon: Activity,
    },
    {
      id: "signup_conversion",
      label: "Conversion signup (24h)",
      value: dashboard.kpis.signupConversion24h,
      helper: `${dashboard.kpis.signupCompleted24h}/${dashboard.kpis.qualifiedVisitors24h} calificados`,
      icon: Target,
      suffix: "%",
    },
    {
      id: "stickiness",
      label: "Stickiness DAU/MAU",
      value: dashboard.kpis.stickinessPct,
      helper: `${dashboard.kpis.dau} DAU / ${dashboard.kpis.mau} MAU`,
      icon: Gauge,
      suffix: "%",
    },
    {
      id: "active_creators",
      label: "Creadores activos (24h)",
      value: dashboard.kpis.activeCreators24h,
      helper: `${dashboard.kpis.generatedImages24h} imagenes generadas`,
      icon: Users,
    },
    {
      id: "success_rate",
      label: "Exito generacion (24h)",
      value: dashboard.kpis.jobsSuccessRate24h,
      helper: `${dashboard.kpis.jobsSucceeded24h}/${dashboard.kpis.jobsStarted24h} jobs`,
      icon: Gauge,
      suffix: "%",
    },
    {
      id: "likes_24h",
      label: "Likes (24h)",
      value: dashboard.kpis.likes24h,
      helper: `${dashboard.kpis.superlikes24h} superlikes`,
      icon: Sparkles,
    },
    {
      id: "saves_24h",
      label: "Guardados en tableros",
      value: dashboard.kpis.boardSaves24h,
      helper: "Interacciones de coleccion",
      icon: Sparkles,
    },
    {
      id: "retention_d7",
      label: "Retencion D7",
      value: dashboard.kpis.retentionD7Pct,
      helper: `D1 ${dashboard.kpis.retentionD1Pct}% | D30 ${dashboard.kpis.retentionD30Pct}%`,
      icon: Gauge,
      suffix: "%",
    },
    {
      id: "notifications_unread",
      label: "Notificaciones sin leer",
      value: dashboard.kpis.notificationsUnread,
      helper: `${dashboard.kpis.notifications24h} creadas en 24h`,
      icon: BellRing,
    },
  ]

  return (
    <section className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold mb-1">KPI Procesados</p>
            <h2 className="text-xl md:text-2xl font-display font-extrabold uppercase tracking-tight text-foreground">
              Salud del producto
            </h2>
          </div>
          {dashboard.generatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Actualizado: {new Date(dashboard.generatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {kpiCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.id} className="rounded-xl border border-border/20 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-bold">
                    {card.label}
                  </p>
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                {loading ? (
                  <div className="h-8 w-24 rounded bg-surface animate-pulse" />
                ) : (
                  <p className="text-2xl font-mono font-bold text-foreground">
                    {card.suffix ? `${card.value}${card.suffix}` : formatCompact(card.value)}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{card.helper}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
        <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChartColumnIncreasing className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Funnel 24h</p>
          </div>
          <div className="space-y-3">
            {dashboard.funnel.map((step) => {
              const ratio = Math.max(0, Math.min(100, Math.round((step.value / funnelMax) * 100)))
              return (
                <div key={step.id} className="rounded-xl border border-border/20 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {step.label}
                    </p>
                    <p className="text-sm font-mono font-bold text-foreground">{step.value.toLocaleString()}</p>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#8db100_0%,#d1fe17_55%,#efff95_100%)]"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Senales de salud</p>
          </div>
          <div className="space-y-3">
            {dashboard.healthSignals.map((signal) => (
              <div key={signal.id} className="rounded-xl border border-border/20 bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {signal.label}
                  </p>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${toneClass(signal.tone)}`}>
                    {signal.value}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{signal.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
        <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Adquisicion</p>
          </div>
          <div className="space-y-3">
            {dashboard.topSources.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin sesiones suficientes para mostrar fuentes.</p>
            ) : (
              dashboard.topSources.map((source) => (
                <div key={source.source} className="rounded-xl border border-border/20 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
                      {source.source}
                    </p>
                    <p className="text-sm font-mono font-bold text-foreground">{source.sessions.toLocaleString()}</p>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#8db100_0%,#d1fe17_55%,#efff95_100%)]"
                      style={{ width: `${Math.max(2, Math.min(100, source.sharePct))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{source.sharePct}% share de sesiones</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Retencion por cohortes</p>
          </div>
          <div className="space-y-3">
            <RetentionRow label="D1" value={dashboard.kpis.retentionD1Pct} />
            <RetentionRow label="D7" value={dashboard.kpis.retentionD7Pct} />
            <RetentionRow label="D30" value={dashboard.kpis.retentionD30Pct} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/20 bg-card p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Top creadores (24h)</p>
        </div>
        {dashboard.topCreators.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aun no hay datos suficientes para ranking de creadores.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.topCreators.map((creator) => (
              <div
                key={creator.userId}
                className="grid grid-cols-[42px_minmax(0,1fr)_repeat(3,minmax(0,110px))] gap-2 items-center rounded-xl border border-border/20 bg-background/50 px-3 py-2.5"
              >
                <div className="inline-flex items-center justify-center rounded-lg bg-surface text-foreground text-sm font-mono font-bold">
                  #{creator.position}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">@{creator.username}</p>
                  <p className="text-[11px] text-muted-foreground">{creator.imagesGenerated24h} imagenes</p>
                </div>
                <StatMini label="Likes" value={creator.likesReceived24h} />
                <StatMini label="Superlikes" value={creator.superlikesReceived24h} icon={Crown} />
                <StatMini label="Inmortales" value={creator.immortalized24h} icon={Sparkles} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function RetentionRow(props: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, props.value))
  return (
    <div className="rounded-xl border border-border/20 bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-bold">{props.label}</p>
        <p className="text-sm font-mono font-bold text-foreground">{props.value}%</p>
      </div>
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#8db100_0%,#d1fe17_55%,#efff95_100%)]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  )
}

function StatMini(props: { label: string; value: number; icon?: ComponentType<{ className?: string }> }) {
  const Icon = props.icon
  return (
    <div className="rounded-lg border border-border/20 bg-black/20 px-2 py-1.5 text-center">
      <div className="inline-flex items-center gap-1 justify-center">
        {Icon ? <Icon className="w-3 h-3 text-primary" /> : null}
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">{props.label}</p>
      </div>
      <p className="text-sm font-mono font-bold text-foreground">{props.value.toLocaleString()}</p>
    </div>
  )
}
