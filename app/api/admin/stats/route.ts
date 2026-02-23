import { NextRequest, NextResponse } from "next/server"
import { adminApiErrorResponse, requireAdminApiContext } from "@/lib/admin/api-auth"

type HealthTone = "good" | "warn" | "critical"

interface GenerationJobRow {
  id: string
  user_id: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface ImageResultRow {
  image_id: string
  status: "survived" | "died"
  finalized_at: string
}

interface LiveRankingRow {
  id: string
  rank_in_cohort: number
  cohort_size: number
  cutoff_position: number
  likes_needed: number
  will_survive: boolean
}

interface AnalyticsWindowSummaryRow {
  visitors: number
  sessions: number
  qualified_visitors: number
  signup_completed: number
  page_views: number
}

interface AnalyticsSourceRow {
  source: string
  sessions: number
  share_pct: number
}

interface RetentionSnapshotRow {
  d1_retention_pct: number
  d7_retention_pct: number
  d30_retention_pct: number
  matured_d1_cohorts: number
  matured_d7_cohorts: number
  matured_d30_cohorts: number
}

interface GeneratedEngagementSummaryRow {
  generated_images: number | string
  likes_received: number | string
  superlikes_received: number | string
  immortalized: number | string
  creators: number | string
}

interface GeneratedCreatorStatsRow {
  user_id: string
  images_generated: number | string
  likes_received: number | string
  superlikes_received: number | string
  immortalized: number | string
  score: number | string
}

function safeCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

function round(value: number, decimals = 1) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function toneByThreshold(value: number, goodAt: number, warnAt: number): HealthTone {
  if (value >= goodAt) {
    return "good"
  }
  if (value >= warnAt) {
    return "warn"
  }
  return "critical"
}

function toNumeric(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const now = new Date()
    const nowIso = now.toISOString()
    const since24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const since7dIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const todayUtcDate = nowIso.slice(0, 10)
    const mauStartDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [
      usersRes,
      activeImagesRes,
      immortalImagesRes,
      hallOfFameRes,
      likes24hRes,
      superlikes24hRes,
      pendingRes,
      boardSaves24hRes,
      notifications24hRes,
      unreadNotificationsRes,
      jobs24hRes,
      generatedEngagementSummaryRes,
      generatedCreatorStatsRes,
      imageResults24hRes,
      liveRankingRes,
      analytics24hRes,
      analytics7dRes,
      analyticsTopSourcesRes,
      retentionSnapshotRes,
      dauRes,
      mauRes,
      profilesSignups24hRes,
    ] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("images").select("id", { count: "exact", head: true }).is("deleted_at", null),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_immortal", true),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_hall_of_fame", true),
      context.supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("superlikes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_immortal", false),
      context.supabase
        .from("board_items")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      context.supabase
        .from("generation_jobs")
        .select("id,user_id,status,created_at,started_at,completed_at")
        .gte("created_at", since24hIso)
        .order("created_at", { ascending: false })
        .limit(5000),
      context.supabase
        .rpc("get_generated_engagement_summary_window", {
          p_since: since24hIso,
          p_until: nowIso,
        }),
      context.supabase
        .rpc("get_generated_creator_stats_window", {
          p_since: since24hIso,
          p_until: nowIso,
          p_limit: 8,
        }),
      context.supabase
        .from("image_results")
        .select("image_id,status,finalized_at")
        .gte("finalized_at", since24hIso)
        .order("finalized_at", { ascending: false })
        .limit(5000),
      context.supabase.rpc("get_live_ranking"),
      context.supabase.rpc("get_analytics_window_summary", {
        p_since: since24hIso,
        p_until: nowIso,
      }),
      context.supabase.rpc("get_analytics_window_summary", {
        p_since: since7dIso,
        p_until: nowIso,
      }),
      context.supabase.rpc("get_analytics_top_sources", {
        p_since: since7dIso,
        p_until: nowIso,
        p_limit: 6,
      }),
      context.supabase.rpc("get_retention_snapshot", {
        p_lookback_days: 120,
      }),
      context.supabase
        .from("analytics_active_user_days")
        .select("user_id", { count: "exact", head: true })
        .eq("activity_date", todayUtcDate),
      context.supabase
        .from("analytics_active_user_days")
        .select("user_id", { count: "exact", head: true })
        .gte("activity_date", mauStartDate),
      context.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
    ])

    const jobs = (jobs24hRes.data ?? []) as GenerationJobRow[]
    const generatedEngagementSummary = ((generatedEngagementSummaryRes.data ?? [])[0] ??
      null) as GeneratedEngagementSummaryRow | null
    const generatedCreatorStats = (generatedCreatorStatsRes.data ?? []) as GeneratedCreatorStatsRow[]
    const imageResults24h = (imageResults24hRes.data ?? []) as ImageResultRow[]
    const liveRankingRows = (liveRankingRes.data ?? []) as LiveRankingRow[]
    const analytics24h = ((analytics24hRes.data ?? [])[0] ?? null) as AnalyticsWindowSummaryRow | null
    const analytics7d = ((analytics7dRes.data ?? [])[0] ?? null) as AnalyticsWindowSummaryRow | null
    const retentionSnapshot = ((retentionSnapshotRes.data ?? [])[0] ?? null) as RetentionSnapshotRow | null
    const topSourcesRows = (analyticsTopSourcesRes.data ?? []) as AnalyticsSourceRow[]

    if (generatedEngagementSummaryRes.error) {
      console.error("[admin/stats] generated_engagement_summary_error", generatedEngagementSummaryRes.error)
    }
    if (generatedCreatorStatsRes.error) {
      console.error("[admin/stats] generated_creator_stats_error", generatedCreatorStatsRes.error)
    }

    const jobsStarted24h = jobs.length
    const jobsSucceeded24h = jobs.filter((job) => job.status === "succeeded").length
    const jobsFailed24h = jobs.filter((job) => job.status === "failed").length
    const jobsCancelled24h = jobs.filter((job) => job.status === "cancelled").length
    const activeCreators24h = new Set(jobs.map((job) => job.user_id)).size

    const completionMinutes = jobs
      .filter((job) => job.status === "succeeded" && job.started_at && job.completed_at)
      .map((job) => {
        const startMs = Date.parse(job.started_at as string)
        const endMs = Date.parse(job.completed_at as string)
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
          return null
        }
        return (endMs - startMs) / 60_000
      })
      .filter((value): value is number => typeof value === "number")

    const generatedImages24h = toNumeric(generatedEngagementSummary?.generated_images)
    const likesOnGenerated24h = toNumeric(generatedEngagementSummary?.likes_received)
    const superlikesOnGenerated24h = toNumeric(generatedEngagementSummary?.superlikes_received)
    const immortalizedGenerated24h = toNumeric(generatedEngagementSummary?.immortalized)

    const likesNeededValues = liveRankingRows
      .map((row) => Number(row.likes_needed))
      .filter((value) => Number.isFinite(value) && value > 0)
    const likesNeededMedian = round(median(likesNeededValues), 0)
    const competitionEdgeCount = liveRankingRows.filter((row) => {
      const rank = Number(row.rank_in_cohort)
      const cutoff = Number(row.cutoff_position)
      return Number.isFinite(rank) && Number.isFinite(cutoff) && Math.abs(rank - cutoff) <= 2
    }).length

    const closedCohorts24h = imageResults24h.length
    const survivedClosed24h = imageResults24h.filter((item) => item.status === "survived").length
    const survivalRateClosed24h =
      closedCohorts24h > 0 ? round((survivedClosed24h / closedCohorts24h) * 100, 1) : 0

    const topCreatorRows = generatedCreatorStats.map((row) => ({
      userId: row.user_id,
      images: toNumeric(row.images_generated),
      likes: toNumeric(row.likes_received),
      superlikes: toNumeric(row.superlikes_received),
      immortal: toNumeric(row.immortalized),
      score: toNumeric(row.score),
    }))
    const topCreatorIds = topCreatorRows.map((row) => row.userId)

    const profilesMap = new Map<string, string>()
    if (topCreatorIds.length > 0) {
      const { data: topProfiles } = await context.supabase
        .from("profiles")
        .select("id,username")
        .in("id", topCreatorIds)

      for (const profile of topProfiles ?? []) {
        profilesMap.set(profile.id, profile.username ?? "creator")
      }
    }

    const topCreators = topCreatorRows.map((row, index) => ({
      position: index + 1,
      userId: row.userId,
      username: profilesMap.get(row.userId) ?? "creator",
      imagesGenerated24h: row.images,
      likesReceived24h: row.likes,
      superlikesReceived24h: row.superlikes,
      immortalized24h: row.immortal,
    }))

    const jobsSuccessRate24h = jobsStarted24h > 0 ? round((jobsSucceeded24h / jobsStarted24h) * 100, 1) : 0
    const averageGenerationMinutes24h = round(average(completionMinutes), 1)
    const avgLikesPerGenerated24h =
      generatedImages24h > 0 ? round(likesOnGenerated24h / generatedImages24h, 1) : 0

    const visitors24h = safeCount(analytics24h?.visitors)
    const visitors7d = safeCount(analytics7d?.visitors)
    const sessions24h = safeCount(analytics24h?.sessions)
    const sessions7d = safeCount(analytics7d?.sessions)
    const qualifiedVisitors24h = safeCount(analytics24h?.qualified_visitors)
    const signupCompleted24h = safeCount(analytics24h?.signup_completed)
    const signupConversion24h =
      qualifiedVisitors24h > 0 ? round((signupCompleted24h / qualifiedVisitors24h) * 100, 2) : 0
    const retentionD1Pct = round(Number(retentionSnapshot?.d1_retention_pct ?? 0), 2)
    const retentionD7Pct = round(Number(retentionSnapshot?.d7_retention_pct ?? 0), 2)
    const retentionD30Pct = round(Number(retentionSnapshot?.d30_retention_pct ?? 0), 2)
    const dau = safeCount(dauRes.count)
    const mau = safeCount(mauRes.count)
    const stickinessPct = mau > 0 ? round((dau / mau) * 100, 2) : 0
    const signupProfiles24h = safeCount(profilesSignups24hRes.count)
    const signupTrackingCoveragePct =
      signupProfiles24h > 0 ? round((signupCompleted24h / signupProfiles24h) * 100, 2) : 100

    const topSources = topSourcesRows.map((row) => ({
      source: row.source || "direct",
      sessions: safeCount(row.sessions),
      sharePct: round(Number(row.share_pct ?? 0), 2),
    }))

    const kpis = {
      usersTotal: safeCount(usersRes.count),
      activeCreators24h,
      imagesActive: safeCount(activeImagesRes.count),
      imagesPending: safeCount(pendingRes.count),
      immortalImages: safeCount(immortalImagesRes.count),
      hallOfFameImages: safeCount(hallOfFameRes.count),
      likes24h: safeCount(likes24hRes.count),
      superlikes24h: safeCount(superlikes24hRes.count),
      boardSaves24h: safeCount(boardSaves24hRes.count),
      notifications24h: safeCount(notifications24hRes.count),
      notificationsUnread: safeCount(unreadNotificationsRes.count),
      jobsStarted24h,
      jobsSucceeded24h,
      jobsFailed24h,
      jobsCancelled24h,
      jobsSuccessRate24h,
      averageGenerationMinutes24h,
      generatedImages24h,
      avgLikesPerGenerated24h,
      avgSuperlikesPerGenerated24h:
        generatedImages24h > 0 ? round(superlikesOnGenerated24h / generatedImages24h, 2) : 0,
      immortalizedGenerated24h,
      likesNeededMedian,
      competitionLiveCount: liveRankingRows.length,
      competitionEdgeCount,
      closedCohorts24h,
      survivedClosed24h,
      survivalRateClosed24h,
      visitors24h,
      visitors7d,
      sessions24h,
      sessions7d,
      qualifiedVisitors24h,
      signupCompleted24h,
      signupConversion24h,
      retentionD1Pct,
      retentionD7Pct,
      retentionD30Pct,
      dau,
      mau,
      stickinessPct,
      signupProfiles24h,
      signupTrackingCoveragePct,
    }

    const funnel = [
      { id: "jobs_started", label: "Generaciones iniciadas", value: jobsStarted24h },
      { id: "images_published", label: "Imagenes publicadas", value: generatedImages24h },
      { id: "board_saves", label: "Guardadas en tableros", value: safeCount(boardSaves24hRes.count) },
      { id: "survived_closed", label: "Sobrevivieron (cohortes cerradas)", value: survivedClosed24h },
    ]

    const healthSignals = [
      {
        id: "signup_tracking_coverage",
        label: "Cobertura tracking signup",
        value: `${signupTrackingCoveragePct}%`,
        description: `${signupCompleted24h}/${signupProfiles24h} perfiles nuevos tienen evento signup_completed en 24h.`,
        tone: toneByThreshold(signupTrackingCoveragePct, 98, 90),
      },
      {
        id: "growth_conversion",
        label: "Conversion qualified -> signup",
        value: `${signupConversion24h}%`,
        description: `${signupCompleted24h}/${qualifiedVisitors24h} visitantes calificados se registraron en 24h.`,
        tone: toneByThreshold(signupConversion24h, 8, 3),
      },
      {
        id: "generation_success",
        label: "Exito de generacion",
        value: `${jobsSuccessRate24h}%`,
        description: `${jobsSucceeded24h}/${jobsStarted24h || 0} jobs finalizados correctamente en 24h.`,
        tone: toneByThreshold(jobsSuccessRate24h, 92, 80),
      },
      {
        id: "creator_activation",
        label: "Activacion de creadores",
        value: activeCreators24h.toLocaleString(),
        description: "Creadores unicos que iniciaron jobs durante la ventana.",
        tone: toneByThreshold(activeCreators24h, 25, 10),
      },
      {
        id: "survival_pressure",
        label: "Presion de supervivencia",
        value: likesNeededMedian > 0 ? `${likesNeededMedian} likes` : "N/A",
        description: "Mediana de likes necesarios para quedar por encima del corte vivo.",
        tone:
          likesNeededMedian === 0
            ? "warn"
            : likesNeededMedian <= 5
              ? "good"
              : likesNeededMedian <= 12
                ? "warn"
                : "critical",
      },
      {
        id: "notification_backlog",
        label: "Backlog de notificaciones",
        value: safeCount(unreadNotificationsRes.count).toLocaleString(),
        description: "Notificaciones sin leer acumuladas en la plataforma.",
        tone:
          safeCount(unreadNotificationsRes.count) <= 200
            ? "good"
            : safeCount(unreadNotificationsRes.count) <= 800
              ? "warn"
              : "critical",
      },
    ] as const

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      window: {
        label: "last_24h",
        since: since24hIso,
        until: nowIso,
      },
      kpis,
      funnel,
      healthSignals,
      topCreators,
      topSources,

      // Backward-compatible keys for existing consumers.
      usersTotal: kpis.usersTotal,
      imagesActive: kpis.imagesActive,
      imagesPending: kpis.imagesPending,
      immortalImages: kpis.immortalImages,
      hallOfFameImages: kpis.hallOfFameImages,
      likes24h: kpis.likes24h,
      superlikes24h: kpis.superlikes24h,
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
