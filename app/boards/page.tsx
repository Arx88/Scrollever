"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  FolderHeart,
  Globe2,
  LayoutGrid,
  Lock,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react"
import { Header } from "@/components/header"

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

const VISIBILITY_OPTIONS: Array<{
  value: "public" | "private" | "collab"
  label: string
  icon: LucideIcon
}> = [
  { value: "private", label: "Privado", icon: Lock },
  { value: "public", label: "Publico", icon: Globe2 },
  { value: "collab", label: "Colaborativo", icon: Users },
]

const BROWSE_VISIBILITY_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "private", label: "Privados" },
  { value: "public", label: "Publicos" },
  { value: "collab", label: "Colab" },
] as const

const BROWSE_SCOPE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "editable", label: "Editables" },
] as const

export default function BoardsPage() {
  const [boards, setBoards] = useState<BoardCard[]>([])
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private" | "collab">("private")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedBoardId, setSelectedBoardId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [browseVisibility, setBrowseVisibility] = useState<(typeof BROWSE_VISIBILITY_FILTERS)[number]["value"]>("all")
  const [browseScope, setBrowseScope] = useState<(typeof BROWSE_SCOPE_FILTERS)[number]["value"]>("all")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editableBoards = useMemo(() => boards.filter((board) => board.canEdit), [boards])
  const filteredBoards = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    return boards.filter((board) => {
      if (browseVisibility !== "all" && board.visibility !== browseVisibility) {
        return false
      }
      if (browseScope === "editable" && !board.canEdit) {
        return false
      }
      if (!normalized) {
        return true
      }

      const haystack = `${board.title} ${board.description ?? ""} ${board.ownerUsername}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [boards, browseVisibility, browseScope, searchQuery])

  const boardStats = useMemo(() => {
    const total = boards.length
    const collab = boards.filter((board) => board.visibility === "collab").length
    const publicCount = boards.filter((board) => board.visibility === "public").length
    return { total, collab, publicCount }
  }, [boards])

  const selectedBoardTitle = useMemo(
    () => boards.find((board) => board.id === selectedBoardId)?.title ?? "",
    [boards, selectedBoardId]
  )

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  )

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
        const firstEditable = boardsPayload.items.find((board) => board.canEdit)?.id ?? ""
        setSelectedBoardId(firstEditable || boardsPayload.items[0]?.id || "")

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
      setCreateModalOpen(false)
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
            ? {
                ...board,
                itemCount: board.itemCount + 1,
                coverImageUrl:
                  board.coverImageUrl ?? generatedImages.find((img) => img.id === imageId)?.url ?? null,
              }
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
        <div className="max-w-[1520px] mx-auto space-y-5">
          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
            <div className="p-4 md:p-5 bg-[radial-gradient(circle_at_top_left,rgba(209,254,23,0.2),transparent_55%)] border-b border-border/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Boards Studio</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setCreateModalOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-all hover:shadow-[0_0_24px_rgba(209,254,23,0.25)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo tablero
                </button>
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-display font-extrabold uppercase tracking-tight text-foreground">
                Tableros con personalidad
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Organiza ideas en publico, privado o colaborativo. Todo conectado con tu flujo de creacion.
              </p>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              <StatPill icon={FolderHeart} label="Tableros" value={boardStats.total} />
              <StatPill icon={Globe2} label="Publicos" value={boardStats.publicCount} />
              <StatPill icon={Users} label="Colab" value={boardStats.collab} />
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs font-bold text-destructive">{error}</p>
            </div>
          )}

          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border/10">
              <div className="flex flex-wrap items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Explorar tableros</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Filtra por visibilidad o por permisos y encuentra rapido donde guardar ideas.
              </p>
            </div>
            <div className="p-4 md:p-5 space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nombre, descripcion o owner"
                  className="w-full rounded-xl border border-border/30 bg-background py-2.5 pl-9 pr-3 text-sm text-foreground"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Visibilidad
                </span>
                {BROWSE_VISIBILITY_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setBrowseVisibility(filter.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      browseVisibility === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Permiso</span>
                {BROWSE_SCOPE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setBrowseScope(filter.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      browseScope === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="ml-auto text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {filteredBoards.length} resultados
                </span>
              </div>
            </div>
          </section>

          {selectedBoard ? (
            <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="relative aspect-[4/3] lg:aspect-auto bg-surface">
                  {selectedBoard.coverImageUrl ? (
                    <img
                      src={selectedBoard.coverImageUrl}
                      alt={selectedBoard.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/40">
                      <FolderHeart className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
                </div>
                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Destino activo</p>
                    <VisibilityBadge visibility={selectedBoard.visibility} />
                  </div>
                  <h2 className="mt-2 text-xl font-display font-extrabold uppercase tracking-tight text-foreground">
                    {selectedBoard.title}
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedBoard.description || "Sin descripcion"} | @{selectedBoard.ownerUsername}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
                      {selectedBoard.itemCount} ideas
                    </span>
                    <span className="rounded-lg border border-border/30 bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      {selectedBoard.canEdit ? "Editable" : "Solo lectura"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <Link
                      href={`/boards/${selectedBoard.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      Abrir tablero
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="aspect-[4/5] rounded-2xl bg-surface animate-pulse" />
              ))
            ) : filteredBoards.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 2xl:col-span-4 rounded-2xl border border-border/20 bg-card p-8 text-center">
                <FolderHeart className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground uppercase tracking-wide">
                  No hay tableros para esos filtros
                </p>
              </div>
            ) : (
              filteredBoards.map((board, index) => (
                <article
                  key={board.id}
                  className={`group rounded-2xl border overflow-hidden bg-card transition-all ${
                    board.id === selectedBoardId
                      ? "border-primary/45 shadow-[0_0_0_1px_rgba(209,254,23,0.18)]"
                      : "border-border/20"
                  }`}
                >
                  <div
                    className={`relative bg-surface ${
                      index % 6 === 0 ? "aspect-[4/6]" : index % 5 === 0 ? "aspect-[5/6]" : "aspect-[4/5]"
                    }`}
                  >
                    {board.coverImageUrl ? (
                      <img src={board.coverImageUrl} alt={board.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <FolderHeart className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <VisibilityBadge visibility={board.visibility} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-sm font-bold text-foreground">{board.title}</p>
                      <p className="text-[11px] text-foreground/75 line-clamp-2">
                        {board.description || "Sin descripcion"}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em]">
                        <span className="text-primary font-bold">{board.itemCount} ideas</span>
                        <span className="text-foreground/60">@{board.ownerUsername}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (board.canEdit) {
                          setSelectedBoardId(board.id)
                        }
                      }}
                      disabled={!board.canEdit}
                      className={`px-2 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                        board.id === selectedBoardId
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      {board.canEdit ? "Guardar aqui" : "Solo lectura"}
                    </button>
                    <Link
                      href={`/boards/${board.id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-surface text-foreground hover:bg-primary hover:text-primary-foreground text-[11px] font-bold uppercase tracking-wider transition-colors"
                    >
                      Abrir
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-border/20 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Guardar imagenes generadas</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Selecciona destino y guarda ideas en segundos.
                </p>
              </div>
              <div className="w-full sm:w-auto min-w-[250px]">
                <select
                  value={selectedBoardId}
                  onChange={(event) => setSelectedBoardId(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border/30 bg-background text-xs text-foreground"
                >
                  {editableBoards.length === 0 ? <option value="">Sin tableros editables</option> : null}
                  {editableBoards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.title}
                    </option>
                  ))}
                </select>
                {selectedBoardTitle ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Destino actual: <span className="text-foreground">{selectedBoardTitle}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="p-3">
              {generatedImages.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Genera imagenes en{" "}
                  <Link href="/create" className="text-primary font-bold">
                    /create
                  </Link>{" "}
                  para guardarlas aqui.
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {generatedImages.map((image) => (
                    <article
                      key={image.id}
                      className="min-w-[170px] max-w-[170px] rounded-xl border border-border/20 bg-surface overflow-hidden"
                    >
                      <div className="relative aspect-[3/4]">
                        <img src={image.url} alt={image.prompt} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
                          <p className="text-[10px] text-foreground/85 line-clamp-2">{image.prompt}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveImageToBoard(image.id)}
                        disabled={!selectedBoardId || savingImageId === image.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60"
                      >
                        <Save className="w-3 h-3" />
                        {savingImageId === image.id ? "Guardando..." : "Guardar"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {createModalOpen ? (
            <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm p-4 md:p-6">
              <div className="mx-auto mt-[8vh] w-full max-w-2xl rounded-2xl border border-border/30 bg-card shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-border/10 p-4 md:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Nuevo tablero</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Crea un board sin salir de tu flujo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="rounded-lg bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-4 md:p-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Nombre del tablero"
                      className="w-full rounded-xl border border-border/30 bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Descripcion
                    </label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Descripcion corta (opcional)"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border/30 bg-background px-3 py-2.5 text-sm text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Visibilidad</p>
                    <div className="grid grid-cols-3 gap-2">
                      {VISIBILITY_OPTIONS.map((option) => {
                        const Icon = option.icon
                        const active = visibility === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setVisibility(option.value)}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/10 p-4 md:p-5">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="rounded-lg bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void createBoard()}
                    disabled={creating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:shadow-[0_0_24px_rgba(209,254,23,0.25)] disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {creating ? "Creando..." : "Crear tablero"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function StatPill(props: { icon: LucideIcon; label: string; value: number }) {
  const Icon = props.icon
  return (
    <div className="rounded-xl border border-border/20 bg-surface/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <p className="text-[10px] uppercase tracking-[0.14em] font-bold">{props.label}</p>
      </div>
      <p className="mt-2 text-xl font-display font-extrabold text-foreground">{props.value}</p>
    </div>
  )
}

function VisibilityBadge(props: { visibility: "public" | "private" | "collab" }) {
  const icon =
    props.visibility === "public" ? (
      <Globe2 className="w-3 h-3" />
    ) : props.visibility === "private" ? (
      <Lock className="w-3 h-3" />
    ) : (
      <Users className="w-3 h-3" />
    )

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/55 border border-white/10 text-[10px] uppercase tracking-wider text-foreground/85">
      {icon}
      {props.visibility}
    </span>
  )
}
