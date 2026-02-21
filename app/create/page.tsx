"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, Sparkles, Wand2, Save, ArrowRight } from "lucide-react"
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
  const [error, setError] = useState<string | null>(null)

  const successfulJobs = useMemo(() => jobs.filter((job) => job.resultImage), [jobs])

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
      setError("Escribi un prompt para generar")
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

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-[72px] pb-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4 lg:gap-6">
          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden h-fit xl:sticky xl:top-[86px]">
            <div className="p-4 md:p-5 border-b border-border/10 bg-[radial-gradient(circle_at_top_right,rgba(209,254,23,0.13),transparent_55%)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Creator Studio</p>
              <h1 className="mt-2 text-2xl font-display font-extrabold uppercase tracking-tight text-foreground">
                Diseña tu próxima imagen viral
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Gratis hoy: {remainingToday}/{dailyLimit}
              </p>
            </div>

            <div className="p-4 md:p-5 space-y-4">
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs font-bold text-destructive">{error}</p>
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe exactamente lo que quieres crear..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground resize-none"
                />
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
                        className={`px-2 py-2 rounded-lg text-[11px] font-bold ${
                          selectedAspect === ratio
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-muted-foreground hover:text-foreground"
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
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider disabled:opacity-60"
              >
                <Wand2 className="w-4 h-4" />
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
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border/20 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Generaciones recientes</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Aquí ves resultados de tus jobs AI y puedes guardarlos en tus tableros colaborativos.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="aspect-[9/16] rounded-xl bg-surface animate-pulse" />
                ))}
              </div>
            ) : successfulJobs.length === 0 ? (
              <div className="rounded-2xl border border-border/20 bg-card p-8 text-center">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">Todavía no hay imágenes</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Genera tu primera imagen y empieza a construir tu colección.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {successfulJobs.map((job) => (
                  <article key={job.id} className="group rounded-xl border border-border/20 bg-card overflow-hidden">
                    <div className="relative aspect-[9/16] bg-surface">
                      <img
                        src={job.resultImage!.url}
                        alt={job.prompt}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2.5 space-y-2">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.15em] truncate">
                        {job.providerKey} · {job.modelKey}
                      </p>
                      <p className="text-[11px] text-foreground line-clamp-2">{job.prompt}</p>
                      <button
                        type="button"
                        onClick={() => void saveToBoard(job.resultImage!.id)}
                        disabled={savingImageId === job.resultImage!.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-surface text-foreground hover:bg-primary hover:text-primary-foreground text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingImageId === job.resultImage!.id ? "Guardando..." : "Guardar idea"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
