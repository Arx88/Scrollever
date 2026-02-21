"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { FolderHeart, Globe2, Lock, Plus, Save, Users, ArrowRight } from "lucide-react"

interface BoardCard {
  id: string
  title: string
  description: string | null
  visibility: "public" | "private" | "collab"
  coverImageUrl: string | null
  ownerUsername: string
  itemCount: number
  canEdit: boolean
}

interface GeneratedImage {
  id: string
  url: string
  prompt: string
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<BoardCard[]>([])
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private" | "collab">("private")
  const [selectedBoardId, setSelectedBoardId] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editableBoards = useMemo(() => boards.filter((board) => board.canEdit), [boards])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [boardsRes, jobsRes] = await Promise.all([
          fetch("/api/boards?scope=mine&limit=100", { cache: "no-store" }),
          fetch("/api/generation/jobs?limit=50", { cache: "no-store" }),
        ])

        if (!boardsRes.ok) {
          throw new Error("boards_load_failed")
        }

        const boardsPayload = (await boardsRes.json()) as { items: BoardCard[] }
        const jobsPayload = jobsRes.ok
          ? ((await jobsRes.json()) as {
              items: Array<{ resultImage: { id: string; url: string } | null; prompt: string }>
            })
          : { items: [] as Array<{ resultImage: { id: string; url: string } | null; prompt: string }> }

        if (!mounted) return

        setBoards(boardsPayload.items)
        setSelectedBoardId(boardsPayload.items[0]?.id ?? "")

        const uniqueImages = new Map<string, GeneratedImage>()
        for (const job of jobsPayload.items) {
          if (!job.resultImage) continue
          if (!uniqueImages.has(job.resultImage.id)) {
            uniqueImages.set(job.resultImage.id, {
              id: job.resultImage.id,
              url: job.resultImage.url,
              prompt: job.prompt,
            })
          }
        }
        setGeneratedImages(Array.from(uniqueImages.values()))
      } catch {
        if (mounted) {
          setError("No se pudieron cargar los tableros")
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

  const createBoard = async () => {
    if (title.trim().length < 2) {
      setError("El tablero necesita un titulo")
      return
    }

    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() ? description : null,
          visibility,
        }),
      })
      const payload = (await response.json()) as { item?: BoardCard; error?: string }

      if (!response.ok || !payload.item) {
        throw new Error(payload.error ?? "create_board_failed")
      }

      setBoards((prev) => [payload.item!, ...prev])
      setSelectedBoardId(payload.item.id)
      setTitle("")
      setDescription("")
      setVisibility("private")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el tablero")
    } finally {
      setCreating(false)
    }
  }

  const saveImageToBoard = async (imageId: string) => {
    if (!selectedBoardId) {
      setError("Selecciona un tablero editable")
      return
    }

    setSavingImageId(imageId)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${selectedBoardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })

      if (!response.ok) {
        throw new Error("No se pudo guardar la imagen")
      }

      setBoards((prev) =>
        prev.map((board) =>
          board.id === selectedBoardId
            ? { ...board, itemCount: board.itemCount + 1, coverImageUrl: board.coverImageUrl ?? generatedImages.find((img) => img.id === imageId)?.url ?? null }
            : board
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la imagen")
    } finally {
      setSavingImageId(null)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-[72px] pb-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-5">
          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(209,254,23,0.14),transparent_52%)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Boards Studio</p>
              <h1 className="mt-2 text-2xl md:text-3xl font-display font-extrabold uppercase tracking-tight text-foreground">
                Tus tableros de inspiración
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Público, privado o colaborativo. Diseñado para coleccionar y organizar imágenes con personalidad.
              </p>
            </div>

            <div className="p-4 md:p-5 grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr_auto] gap-2.5">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nombre del tablero"
                className="px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground"
              />
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción (opcional)"
                className="px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground"
              />
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public" | "private" | "collab")}
                className="px-3 py-2 rounded-xl border border-border/30 bg-background text-sm text-foreground"
              >
                <option value="private">Privado</option>
                <option value="public">Público</option>
                <option value="collab">Colaborativo</option>
              </select>
              <button
                type="button"
                onClick={() => void createBoard()}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? "Creando..." : "Crear"}
              </button>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs font-bold text-destructive">{error}</p>
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/5] rounded-2xl bg-surface animate-pulse" />
              ))
            ) : boards.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-border/20 bg-card p-8 text-center">
                <FolderHeart className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">No tienes tableros todavía</p>
              </div>
            ) : (
              boards.map((board) => (
                <article key={board.id} className="rounded-2xl border border-border/20 bg-card overflow-hidden">
                  <div className="aspect-[4/5] bg-surface">
                    {board.coverImageUrl ? (
                      <img src={board.coverImageUrl} alt={board.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <FolderHeart className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">{board.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {board.description || "Sin descripción"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                        {board.visibility === "public" ? <Globe2 className="w-3 h-3" /> : null}
                        {board.visibility === "private" ? <Lock className="w-3 h-3" /> : null}
                        {board.visibility === "collab" ? <Users className="w-3 h-3" /> : null}
                        {board.visibility}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {board.itemCount} ideas
                      </p>
                      <Link
                        href={`/boards/${board.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"
                      >
                        Abrir
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/10 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Guardar imágenes generadas</p>
              <select
                value={selectedBoardId}
                onChange={(event) => setSelectedBoardId(event.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border/30 bg-background text-xs text-foreground"
              >
                {editableBoards.length === 0 ? <option value="">Sin tableros editables</option> : null}
                {editableBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {generatedImages.length === 0 ? (
                <div className="col-span-full p-6 text-center text-xs text-muted-foreground">
                  Genera imágenes en <Link href="/create" className="text-primary font-bold">/create</Link> para guardarlas aquí.
                </div>
              ) : (
                generatedImages.map((image) => (
                  <article key={image.id} className="rounded-xl border border-border/20 bg-surface overflow-hidden">
                    <div className="aspect-[9/16]">
                      <img src={image.url} alt={image.prompt} className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveImageToBoard(image.id)}
                      disabled={savingImageId === image.id}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60"
                    >
                      <Save className="w-3 h-3" />
                      {savingImageId === image.id ? "..." : "Guardar"}
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
