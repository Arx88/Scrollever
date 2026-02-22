"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock3,
  Filter,
  ImagePlus,
  Layers3,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Header } from "@/components/header"

interface CreatorModel {
  providerKey: string
  modelKey: string
  displayName: string
  description: string | null
}

interface GenerationJobItem {
  id: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  prompt: string
  modelKey: string
  providerKey: string
  createdAt: string
  resultImage: {
    id: string
    url: string
    created_at: string
  } | null
}

interface BoardItem {
  id: string
  title: string
  visibility: "public" | "private" | "collab"
}

const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const

const PROMPT_STARTERS = [
  "editorial fashion portrait, dramatic lighting",
  "streetwear campaign, high contrast, textured grain",
  "luxury product hero, glossy reflections, studio setup",
  "cinematic still, volumetric light, film look",
  "retro futurism, neon accents, bold composition",
] as const

type JobFilter = "all" | "ready" | "active" | "failed"

const JOB_FILTER_OPTIONS: Array<{ value: JobFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "ready", label: "Listas" },
  { value: "active", label: "En proceso" },
  { value: "failed", label: "Errores" },
]

const STATUS_META: Record<
  GenerationJobItem["status"],
  {
    label: string
    tone: string
    cardTone: string
    icon: LucideIcon
    spin?: boolean
  }
> = {
  queued: {
    label: "En cola",
    tone: "text-sky-300 border-sky-500/30 bg-sky-500/12",
    cardTone: "from-sky-500/12 to-transparent",
    icon: Clock3,
  },
  running: {
    label: "Procesando",
    tone: "text-amber-300 border-amber-500/30 bg-amber-500/12",
    cardTone: "from-amber-500/12 to-transparent",
    icon: Loader2,
    spin: true,
  },
  succeeded: {
    label: "Lista",
    tone: "text-primary border-primary/35 bg-primary/12",
    cardTone: "from-primary/12 to-transparent",
    icon: Sparkles,
  },
  failed: {
    label: "Error",
    tone: "text-destructive border-destructive/30 bg-destructive/12",
    cardTone: "from-destructive/12 to-transparent",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelada",
    tone: "text-muted-foreground border-border/30 bg-muted/30",
    cardTone: "from-muted/20 to-transparent",
    icon: Clock3,
  },
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [models, setModels] = useState<CreatorModel[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedAspect, setSelectedAspect] = useState<(typeof ASPECTS)[number]>("9:16")
  const [jobs, setJobs] = useState<GenerationJobItem[]>([])
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [selectedBoard, setSelectedBoard] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [remainingToday, setRemainingToday] = useState<number>(0)
  const [dailyLimit, setDailyLimit] = useState<number>(5)
  const [jobFilter, setJobFilter] = useState<JobFilter>("all")
  const [error, setError] = useState<string | null>(null)

  const usagePercent = useMemo(() => {
    if (!dailyLimit || dailyLimit <= 0) return 0
    const used = Math.max(0, dailyLimit - remainingToday)
    return Math.max(0, Math.min(100, Math.round((used / dailyLimit) * 100)))
  }, [dailyLimit, remainingToday])

  const selectedModelInfo = useMemo(
    () => models.find((model) => model.modelKey === selectedModel) ?? null,
    [models, selectedModel]
  )

  const selectedBoardTitle = useMemo(
    () => boards.find((board) => board.id === selectedBoard)?.title ?? "",
    [boards, selectedBoard]
  )

  const jobStats = useMemo(() => {
    const queued = jobs.filter((job) => job.status === "queued").length
    const running = jobs.filter((job) => job.status === "running").length
    const failed = jobs.filter((job) => job.status === "failed").length
    const completed = jobs.filter((job) => job.status === "succeeded" && job.resultImage).length
    return { queued, running, failed, completed }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    if (jobFilter === "all") return jobs
    if (jobFilter === "ready") {
      return jobs.filter((job) => job.status === "succeeded" && job.resultImage)
    }
    if (jobFilter === "active") {
      return jobs.filter((job) => job.status === "queued" || job.status === "running")
    }
    return jobs.filter((job) => job.status === "failed")
  }, [jobs, jobFilter])

  const promptWordCount = useMemo(() => {
    const trimmed = prompt.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }, [prompt])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [modelsRes, jobsRes, boardsRes] = await Promise.all([
          fetch("/api/generation/models", { cache: "no-store" }),
          fetch("/api/generation/jobs?limit=40", { cache: "no-store" }),
          fetch("/api/boards?scope=mine&limit=100", { cache: "no-store" }),
        ])

        if (!modelsRes.ok || !jobsRes.ok) {
          throw new Error("creator_load_failed")
        }

        const modelsPayload = (await modelsRes.json()) as {
          defaultModelKey: string
          defaultAspectRatio: string
          dailyFreeLimit: number
          models: CreatorModel[]
        }
        const jobsPayload = (await jobsRes.json()) as {
          dailyFreeLimit: number
          remainingToday: number
          items: GenerationJobItem[]
        }
        const boardsPayload = boardsRes.ok
          ? ((await boardsRes.json()) as { items: BoardItem[] })
          : { items: [] as BoardItem[] }

        if (!mounted) return

        setModels(modelsPayload.models)
        setSelectedModel(modelsPayload.defaultModelKey || modelsPayload.models[0]?.modelKey || "")
        if (ASPECTS.includes(modelsPayload.defaultAspectRatio as (typeof ASPECTS)[number])) {
          setSelectedAspect(modelsPayload.defaultAspectRatio as (typeof ASPECTS)[number])
        }
        setJobs(jobsPayload.items)
        setDailyLimit(jobsPayload.dailyFreeLimit ?? modelsPayload.dailyFreeLimit ?? 5)
        setRemainingToday(jobsPayload.remainingToday ?? 0)
        setBoards(boardsPayload.items)
        setSelectedBoard(boardsPayload.items[0]?.id ?? "")
      } catch {
        if (mounted) {
          setError("No se pudo cargar el creador")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const createImage = async () => {
    if (!prompt.trim()) {
      setError("Escribe un prompt para generar")
      return
    }
    if (!selectedModel) {
      setError("Selecciona un modelo")
      return
    }

    setGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/generation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: negativePrompt.trim() ? negativePrompt : null,
          modelKey: selectedModel,
          aspectRatio: selectedAspect,
        }),
      })

      const payload = (await response.json()) as {
        item?: GenerationJobItem
        usage?: {
          dailyFreeLimit: number
          remainingToday: number
        }
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "generate_failed")
      }

      if (payload.item) {
        setJobs((prev) => [payload.item!, ...prev])
      }
      if (payload.usage) {
        setDailyLimit(payload.usage.dailyFreeLimit)
        setRemainingToday(payload.usage.remainingToday)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar imagen")
    } finally {
      setGenerating(false)
    }
  }

  const saveToBoard = async (imageId: string) => {
    if (!selectedBoard) {
      setError("Crea o selecciona un tablero primero")
      return
    }

    setSavingImageId(imageId)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${selectedBoard}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })

      if (!response.ok) {
        throw new Error("No se pudo guardar la imagen en el tablero")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar en tablero")
    } finally {
      setSavingImageId(null)
    }
  }

  const injectPromptStarter = (starter: string) => {
    setPrompt((prev) => (prev.trim().length === 0 ? starter : `${prev.trim()}, ${starter}`))
  }

  const resetPromptComposer = () => {
    setPrompt("")
    setNegativePrompt("")
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-[72px] pb-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-[1520px] mx-auto grid grid-cols-1 2xl:grid-cols-[460px_minmax(0,1fr)] gap-4 lg:gap-6">
          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden h-fit 2xl:sticky 2xl:top-[86px]">
            <div className="p-4 md:p-5 border-b border-border/10 bg-[radial-gradient(circle_at_top_right,rgba(209,254,23,0.2),transparent_55%)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Creator Studio</p>
              <h1 className="mt-2 text-2xl font-display font-extrabold uppercase tracking-tight text-foreground">
                Creador visual premium
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">Construye imagenes con precision, estilo y velocidad.</p>
              <div className="mt-4 rounded-xl border border-border/20 bg-black/50 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground uppercase tracking-[0.15em] font-bold">Uso diario</span>
                  <span className="text-primary font-bold">
                    {Math.max(0, remainingToday)}/{dailyLimit}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8db100_0%,#d1fe17_60%,#eeffa1_100%)]"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5 space-y-4">
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs font-bold text-destructive">{error}</p>
                </div>
              )}

              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Prompt principal
                  </span>
                  <div className="inline-flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {promptWordCount} palabras
                    </span>
                    <button
                      type="button"
                      onClick={resetPromptComposer}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Limpiar
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe exactamente lo que quieres crear..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground resize-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => injectPromptStarter(starter)}
                      className="px-2 py-1 rounded-lg bg-surface text-[10px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      + {starter.split(",")[0]}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Negative Prompt
                </span>
                <textarea
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  placeholder="Elementos que no quieres (opcional)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground resize-none"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Modelo</span>
                  <select
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground"
                  >
                    {models.map((model) => (
                      <option key={model.modelKey} value={model.modelKey}>
                        {model.displayName}
                      </option>
                    ))}
                  </select>
                  {selectedModelInfo?.description ? (
                    <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{selectedModelInfo.description}</p>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Aspect Ratio
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ASPECTS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setSelectedAspect(ratio)}
                        className={`px-2 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                          selectedAspect === ratio
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={() => void createImage()}
                disabled={loading || generating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider disabled:opacity-60 hover:shadow-[0_0_28px_rgba(209,254,23,0.28)] transition-all"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? "Generando..." : "Generar imagen"}
              </button>

              <div className="rounded-xl border border-border/20 bg-surface/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                    Guardar en tablero
                  </p>
                  <Link href="/boards" className="inline-flex items-center gap-1 text-[11px] text-primary font-bold">
                    Administrar boards
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <select
                  value={selectedBoard}
                  onChange={(event) => setSelectedBoard(event.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground"
                >
                  {boards.length === 0 ? <option value="">No tienes tableros</option> : null}
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.title} ({board.visibility})
                    </option>
                  ))}
                </select>
                {selectedBoardTitle ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Destino actual: <span className="text-foreground font-medium">{selectedBoardTitle}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatPill icon={Layers3} label="Completadas" value={jobStats.completed} tone="primary" />
              <StatPill icon={Clock3} label="En cola" value={jobStats.queued} tone="sky" />
              <StatPill icon={Loader2} label="Procesando" value={jobStats.running} tone="amber" spinIcon />
              <StatPill icon={AlertTriangle} label="Errores" value={jobStats.failed} tone="danger" />
            </div>

            <div className="rounded-2xl border border-border/20 bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Generaciones recientes</p>
                </div>
                <Link
                  href="/boards"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  Ir a boards
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Aqui ves toda tu actividad de generacion. Guarda resultados con un clic en el board destino.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Filtro
                </span>
                {JOB_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setJobFilter(option.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      jobFilter === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="aspect-[9/16] rounded-xl bg-surface animate-pulse" />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-2xl border border-border/20 bg-card p-8 text-center">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">
                  No hay resultados para este filtro
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Cambia el filtro o genera una nueva imagen para ver resultados aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredJobs.map((job) => {
                  const status = STATUS_META[job.status]
                  const StatusIcon = status.icon
                  const canSave = Boolean(job.resultImage && selectedBoard)

                  return (
                    <article key={job.id} className="group rounded-xl border border-border/20 bg-card overflow-hidden">
                      <div className={`relative aspect-[9/16] bg-surface bg-gradient-to-b ${status.cardTone}`}>
                        {job.resultImage ? (
                          <img
                            src={job.resultImage.url}
                            alt={job.prompt}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            {job.status === "running" ? (
                              <Loader2 className="w-7 h-7 animate-spin text-amber-300" />
                            ) : (
                              <ImagePlus className="w-7 h-7" />
                            )}
                            <p className="text-[11px] font-bold uppercase tracking-wider">{status.label}</p>
                          </div>
                        )}

                        <div className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur-sm ${status.tone}`}>
                          <StatusIcon className={`w-3 h-3 ${status.spin ? "animate-spin" : ""}`} />
                          {status.label}
                        </div>
                      </div>

                      <div className="p-2.5 space-y-2">
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.15em] truncate">
                          {job.providerKey} | {job.modelKey}
                        </p>
                        <p className="text-[11px] text-foreground line-clamp-2">{job.prompt}</p>
                        <button
                          type="button"
                          onClick={() => (job.resultImage ? void saveToBoard(job.resultImage.id) : undefined)}
                          disabled={!canSave || (job.resultImage ? savingImageId === job.resultImage.id : false)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-surface text-foreground hover:bg-primary hover:text-primary-foreground text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {job.resultImage && savingImageId === job.resultImage.id
                            ? "Guardando..."
                            : canSave
                              ? "Guardar idea"
                              : "Sin resultado"}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function StatPill(props: {
  icon: LucideIcon
  label: string
  value: number
  tone: "primary" | "sky" | "amber" | "danger"
  spinIcon?: boolean
}) {
  const Icon = props.icon
  const toneClass =
    props.tone === "primary"
      ? "text-primary border-primary/30 bg-primary/10"
      : props.tone === "sky"
        ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
        : props.tone === "amber"
          ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
          : "text-destructive border-destructive/30 bg-destructive/10"

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${props.spinIcon ? "animate-spin" : ""}`} />
        <p className="text-[10px] uppercase tracking-[0.14em] font-bold">{props.label}</p>
      </div>
      <p className="mt-2 text-xl font-display font-extrabold leading-none">{props.value}</p>
    </div>
  )
}
