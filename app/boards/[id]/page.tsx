"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { ArrowLeft, Globe2, Lock, Trash2, Users } from "lucide-react"

interface BoardDetails {
  id: string
  title: string
  description: string | null
  visibility: "public" | "private" | "collab"
  ownerUsername: string
  canEdit: boolean
}

interface BoardImageItem {
  id: string
  imageId: string
  note: string | null
  image: {
    id: string
    url: string
    prompt: string | null
    title: string | null
    generation_model: string | null
    generation_provider: string | null
  } | null
}

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const boardId = params.id
  const [board, setBoard] = useState<BoardDetails | null>(null)
  const [items, setItems] = useState<BoardImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const [deletingBoard, setDeletingBoard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!boardId) return

    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [boardRes, itemsRes] = await Promise.all([
          fetch(`/api/boards/${boardId}`, { cache: "no-store" }),
          fetch(`/api/boards/${boardId}/items?limit=300`, { cache: "no-store" }),
        ])

        if (!boardRes.ok || !itemsRes.ok) {
          throw new Error("board_load_failed")
        }

        const boardPayload = (await boardRes.json()) as { item: BoardDetails }
        const itemsPayload = (await itemsRes.json()) as { items: BoardImageItem[] }
        if (!mounted) return

        setBoard(boardPayload.item)
        setItems(itemsPayload.items)
      } catch {
        if (mounted) {
          setError("No se pudo abrir el tablero")
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
  }, [boardId])

  const visibleItems = useMemo(() => items.filter((item) => item.image), [items])

  const removeFromBoard = async (imageId: string) => {
    setDeletingImageId(imageId)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${boardId}/items?imageId=${encodeURIComponent(imageId)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("No se pudo quitar la imagen")
      }

      setItems((prev) => prev.filter((item) => item.imageId !== imageId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la imagen")
    } finally {
      setDeletingImageId(null)
    }
  }

  const deleteBoard = async () => {
    if (!board?.canEdit) {
      return
    }

    const confirmed = window.confirm(`Eliminar tablero "${board.title}"? Esta accion no se puede deshacer.`)
    if (!confirmed) {
      return
    }

    setDeletingBoard(true)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${boardId}`, { method: "DELETE" })
      const payload = (await response.json()) as { ok?: boolean; error?: string; code?: string }
      if (!response.ok || !payload.ok) {
        const errorCode = payload.code ? ` (${payload.code})` : ""
        throw new Error((payload.error ?? "No se pudo eliminar el tablero") + errorCode)
      }
      router.push("/boards")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el tablero")
    } finally {
      setDeletingBoard(false)
    }
  }

  const visibilityIcon = board?.visibility === "public"
    ? <Globe2 className="w-3.5 h-3.5" />
    : board?.visibility === "private"
      ? <Lock className="w-3.5 h-3.5" />
      : <Users className="w-3.5 h-3.5" />

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-[72px] pb-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/boards"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </Link>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs font-bold text-destructive">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="aspect-[9/16] rounded-xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : !board ? (
            <div className="rounded-xl border border-border/20 bg-card p-8 text-center">
              <p className="text-sm font-bold text-foreground uppercase tracking-wide">Tablero no encontrado</p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-border/20 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Board</p>
                    <h1 className="mt-2 text-2xl font-display font-extrabold uppercase tracking-tight text-foreground">
                      {board.title}
                    </h1>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {board.description || "Sin descripcion"} | @{board.ownerUsername}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface text-xs text-muted-foreground uppercase tracking-wider">
                    {visibilityIcon}
                    {board.visibility}
                  </span>
                </div>
                {board.canEdit ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void deleteBoard()}
                      disabled={deletingBoard}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingBoard ? "Eliminando..." : "Eliminar tablero"}
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {visibleItems.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-border/20 bg-card p-8 text-center">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Este tablero todavia esta vacio
                    </p>
                  </div>
                ) : (
                  visibleItems.map((item) => (
                    <article key={item.id} className="rounded-xl border border-border/20 bg-card overflow-hidden">
                      <div className="aspect-[9/16] bg-surface">
                        <img
                          src={item.image!.url}
                          alt={item.image?.prompt ?? item.image?.title ?? "Board image"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2.5 space-y-2">
                        <p className="text-[11px] text-foreground line-clamp-2">
                          {item.image?.prompt || item.image?.title || "Imagen guardada"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.14em] truncate">
                          {item.image?.generation_provider ?? "scrollever"} | {item.image?.generation_model ?? "n/a"}
                        </p>
                        {board.canEdit && (
                          <button
                            type="button"
                            onClick={() => void removeFromBoard(item.imageId)}
                            disabled={deletingImageId === item.imageId}
                            className="w-full inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-surface text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
                          >
                            <Trash2 className="w-3 h-3" />
                            {deletingImageId === item.imageId ? "Quitando..." : "Quitar"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
