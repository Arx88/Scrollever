"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Minus, Plus, RefreshCcw, RotateCcw, Save, WandSparkles } from "lucide-react"
import { LoginPopupCard } from "@/components/login-popup-card"
import { Slider } from "@/components/ui/slider"
import {
  DEFAULT_LOGIN_POPUP_CONFIG,
  type PopupLibraryItem,
  type LoginPopupConfig,
} from "@/lib/admin/popup-config"

interface PopupConfigResponse {
  item: LoginPopupConfig
  library: PopupLibraryItem[]
  activeId: string | null
  canvas?: {
    width: number
    height: number
  }
}

export default function AdminPopupPage() {
  const [config, setConfig] = useState<LoginPopupConfig>(DEFAULT_LOGIN_POPUP_CONFIG)
  const [library, setLibrary] = useState<PopupLibraryItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editorPopupId, setEditorPopupId] = useState<string | null>(null)
  const [canvas, setCanvas] = useState({ width: 1130, height: 700 })
  const [feedImages, setFeedImages] = useState<string[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const widthPercent = config.layout.widthPercent ?? config.layout.sizePercent
  const heightPercent = config.layout.heightPercent ?? config.layout.sizePercent

  const popupWidth = useMemo(
    () => Math.max(300, Math.round(canvas.width * (widthPercent / 100))),
    [canvas.width, widthPercent]
  )
  const popupHeight = useMemo(
    () => Math.max(220, Math.round(canvas.height * (heightPercent / 100))),
    [canvas.height, heightPercent]
  )

  const loadFeedImages = useCallback(async () => {
    setFeedLoading(true)
    try {
      const requests = await Promise.all([
        fetch("/api/images?feed=immortal&limit=80", { cache: "no-store" }),
        fetch("/api/images?feed=hall-of-fame&limit=80", { cache: "no-store" }),
        fetch("/api/images?feed=recent&limit=80", { cache: "no-store" }),
      ])

      const urls = new Set<string>()
      for (const response of requests) {
        if (!response.ok) {
          continue
        }
        const payload = (await response.json()) as {
          items?: Array<{ url?: string }>
        }

        for (const item of payload.items ?? []) {
          if (typeof item.url === "string" && item.url.trim().length > 0) {
            urls.add(item.url)
          }
        }
      }

      setFeedImages(Array.from(urls))
    } catch {
      setFeedImages([])
    } finally {
      setFeedLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/popup", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("popup_fetch_failed")
        }

        const payload = (await response.json()) as PopupConfigResponse
        if (!mounted) {
          return
        }

        setConfig(payload.item)
        setLibrary(payload.library ?? [])
        setActiveId(payload.activeId ?? null)
        setEditorPopupId(payload.activeId ?? null)
        if (payload.canvas?.width && payload.canvas?.height) {
          setCanvas(payload.canvas)
        }
      } catch {
        if (mounted) {
          setError("No se pudo cargar la configuracion del popup")
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

  useEffect(() => {
    void loadFeedImages()
  }, [loadFeedImages])

  useEffect(() => {
    const updateScale = () => {
      const viewport = previewViewportRef.current
      if (!viewport) {
        return
      }

      const next = Math.min(1, viewport.clientWidth / popupWidth)
      setPreviewScale(Number.isFinite(next) && next > 0 ? next : 1)
    }

    updateScale()

    const observer = new ResizeObserver(() => {
      updateScale()
    })

    if (previewViewportRef.current) {
      observer.observe(previewViewportRef.current)
    }

    window.addEventListener("resize", updateScale)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateScale)
    }
  }, [popupWidth])

  const save = async (
    action: "create" | "update" | "activate",
    options?: {
      popupId?: string
      item?: LoginPopupConfig
    }
  ) => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/popup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          popupId: options?.popupId,
          item: options?.item,
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string; issues?: unknown }
          | null
        const details =
          typeof errorPayload?.error === "string" && errorPayload.error.trim().length > 0
            ? errorPayload.error
            : "popup_save_failed"
        throw new Error(details)
      }

      const payload = (await response.json()) as PopupConfigResponse
      setConfig(payload.item)
      setLibrary(payload.library ?? [])
      setActiveId(payload.activeId ?? null)
      setEditorPopupId(payload.activeId ?? null)
      setSavedAt(new Date().toISOString())
    } catch (error) {
      const message = error instanceof Error ? error.message : "popup_save_failed"
      if (message === "popup_save_failed") {
        setError("No se pudo guardar el popup")
      } else {
        setError(`No se pudo guardar: ${message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs font-bold text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(340px,380px)_minmax(0,1fr)] gap-4 min-w-0">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/20 bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1">Admin Popup</p>
              <h2 className="text-lg font-display font-extrabold uppercase tracking-tight text-foreground">
                Creador Informativo
              </h2>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Tamano objetivo {canvas.width}x{canvas.height}. Al crear uno nuevo se republica con version distinta y se vuelve a mostrar.
              </p>
            </div>
          </div>

          {savedAt && !saving && (
            <p className="text-[10px] text-muted-foreground">
              Ultimo guardado: {new Date(savedAt).toLocaleString()}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void save("update", {
                  popupId: editorPopupId ?? activeId ?? undefined,
                  item: config,
                })
              }
              disabled={saving || loading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Actualizar activo"}
            </button>
            <button
              type="button"
              onClick={() => void save("create", { item: config })}
              disabled={saving || loading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-primary/35 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider disabled:opacity-60"
            >
              <WandSparkles className="w-3.5 h-3.5" />
              Crear nuevo + publicar
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-surface/60 px-3 py-2.5">
            <span className="text-xs font-bold text-foreground">Popup activo</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => setConfig((prev) => ({ ...prev, enabled: event.target.checked }))}
              disabled={loading}
            />
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1.5">Titulo</span>
            <input
              type="text"
              value={config.title}
              onChange={(event) => setConfig((prev) => ({ ...prev, title: event.target.value }))}
              disabled={loading}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1.5">Texto</span>
            <textarea
              value={config.message}
              onChange={(event) => setConfig((prev) => ({ ...prev, message: event.target.value }))}
              rows={5}
              disabled={loading}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground resize-y"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1.5">Texto boton</span>
            <input
              type="text"
              value={config.confirmLabel}
              onChange={(event) => setConfig((prev) => ({ ...prev, confirmLabel: event.target.value }))}
              disabled={loading}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-1.5">Version</span>
            <input
              type="text"
              value={config.version}
              onChange={(event) => setConfig((prev) => ({ ...prev, version: event.target.value }))}
              disabled={loading}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <div className="rounded-lg border border-border/20 bg-background/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Layout (palancas)</p>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    layout: { ...DEFAULT_LOGIN_POPUP_CONFIG.layout },
                  }))
                }
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-surface text-foreground hover:bg-surface-hover"
              >
                <RotateCcw className="w-3 h-3" />
                Reset layout
              </button>
            </div>

            <SliderControl
              label="Ancho del popup"
              min={60}
              max={130}
              value={widthPercent}
              leftHint="Estrecho"
              rightHint="Amplio"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, widthPercent: value, sizePercent: value },
                }))
              }
            />

            <SliderControl
              label="Alto del popup"
              min={60}
              max={130}
              value={heightPercent}
              leftHint="Bajo"
              rightHint="Alto"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, heightPercent: value },
                }))
              }
            />

            <SliderControl
              label="Tamano de titulo"
              min={40}
              max={180}
              value={config.layout.titleSizePercent}
              leftHint="Pequeno"
              rightHint="Grande"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, titleSizePercent: value },
                }))
              }
            />

            <SliderControl
              label="Tamano de texto"
              min={50}
              max={180}
              value={config.layout.messageSizePercent}
              leftHint="Pequeno"
              rightHint="Grande"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, messageSizePercent: value },
                }))
              }
            />

            <SliderControl
              label="Tamano de boton"
              min={50}
              max={180}
              value={config.layout.buttonSizePercent}
              leftHint="Pequeno"
              rightHint="Grande"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, buttonSizePercent: value },
                }))
              }
            />

            <SliderControl
              label="Redondeo de bordes"
              min={28}
              max={260}
              value={config.layout.radiusPx}
              leftHint="Agresivo"
              rightHint="Suave"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, radiusPx: value },
                }))
              }
            />

            <SliderControl
              label="Mover bloque de texto (X)"
              min={-200}
              max={200}
              value={config.layout.contentOffsetX}
              leftHint="Izquierda"
              rightHint="Derecha"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, contentOffsetX: value },
                }))
              }
            />

            <SliderControl
              label="Mover bloque de texto (Y)"
              min={-220}
              max={220}
              value={config.layout.contentOffsetY}
              leftHint="Arriba"
              rightHint="Abajo"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, contentOffsetY: value },
                }))
              }
            />

            <SliderControl
              label="Mover titulo (Y)"
              min={-140}
              max={140}
              value={config.layout.titleOffsetY}
              leftHint="Arriba"
              rightHint="Abajo"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, titleOffsetY: value },
                }))
              }
            />

            <SliderControl
              label="Mover texto (Y)"
              min={-140}
              max={140}
              value={config.layout.messageOffsetY}
              leftHint="Arriba"
              rightHint="Abajo"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, messageOffsetY: value },
                }))
              }
            />

            <SliderControl
              label="Mover boton (Y)"
              min={-140}
              max={140}
              value={config.layout.buttonOffsetY}
              leftHint="Arriba"
              rightHint="Abajo"
              onChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, buttonOffsetY: value },
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
                Imagen desde feed
              </p>
              <button
                type="button"
                onClick={() => void loadFeedImages()}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RefreshCcw className="w-3 h-3" />
                Refrescar
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-border/20 bg-background/50 p-2">
              {feedLoading ? (
                <div className="h-24 rounded bg-surface animate-pulse" />
              ) : feedImages.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-1 py-2">No se encontraron imagenes en feed.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {feedImages.map((url) => {
                    const selected = config.imageUrl === url
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, imageUrl: url }))}
                        className={`relative overflow-hidden rounded-md aspect-[9/16] border transition-all ${
                          selected
                            ? "border-primary ring-2 ring-primary/35"
                            : "border-border/20 hover:border-primary/40"
                        }`}
                        title={url}
                      >
                        <Image
                          src={url}
                          alt="Feed image option"
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <input
              type="text"
              value={config.imageUrl}
              onChange={(event) => setConfig((prev) => ({ ...prev, imageUrl: event.target.value }))}
              disabled={loading}
              className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-xs text-foreground font-mono"
              placeholder="URL de imagen seleccionada"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border/20 bg-card p-3 md:p-4">
            <div className="flex items-center gap-2 px-1 mb-3">
              <WandSparkles className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                Preview {canvas.width}x{canvas.height}
              </p>
            </div>

            <div className="rounded-2xl border border-border/10 bg-background/60 p-2 md:p-3 overflow-hidden">
              <div className="rounded-xl overflow-hidden border border-border/20 bg-black">
                <div className="relative min-h-[760px]">
                  <div className="absolute inset-0 p-3 grid grid-cols-3 md:grid-cols-4 gap-2 opacity-80">
                    {(feedImages.length > 0 ? feedImages : [config.imageUrl]).slice(0, 12).map((url, index) => (
                      <div key={`${url}-${index}`} className="relative rounded-lg overflow-hidden border border-black/50">
                        <Image
                          src={url}
                          alt="preview backdrop"
                          fill
                          sizes="260px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-0 bg-black/72 backdrop-blur-[2px]" />

                  <div ref={previewViewportRef} className="relative h-full overflow-hidden px-3">
                    <div
                      className="mx-auto pt-8 pb-14"
                      style={{
                        width: `${popupWidth * previewScale}px`,
                        height: `${popupHeight * previewScale + 90}px`,
                      }}
                    >
                      <div
                        style={{
                          width: `${popupWidth}px`,
                          height: `${popupHeight}px`,
                          transform: `scale(${previewScale})`,
                          transformOrigin: "top left",
                        }}
                      >
                        <LoginPopupCard
                          config={config}
                          onConfirm={() => {
                            // Preview only: keep modal open while preserving hover/interaction states.
                          }}
                          className="w-full max-w-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-0 right-0 bottom-0 h-9 bg-primary/90 border-t border-black/30" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/20 bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Popups guardados</p>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {library.map((entry) => {
                const isActive = activeId === entry.id
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-2 ${
                      isActive ? "border-primary/40 bg-primary/5" : "border-border/20 bg-background/40"
                    }`}
                  >
                    <div className="flex gap-2">
                      <div className="relative w-14 h-16 rounded-md overflow-hidden border border-border/20 shrink-0">
                        <Image src={entry.imageUrl} alt={entry.title} fill sizes="56px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{entry.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">version: {entry.version}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {new Date(entry.updatedAt).toLocaleString()}
                        </p>
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditorPopupId(entry.id)
                              setConfig((prev) => ({
                                enabled: prev.enabled,
                                title: entry.title,
                                message: entry.message,
                                confirmLabel: entry.confirmLabel,
                                imageUrl: entry.imageUrl,
                                version: entry.version,
                                layout: entry.layout,
                              }))
                            }}
                            className="px-2 py-1 rounded-md bg-surface text-[10px] font-bold text-foreground"
                          >
                            Cargar
                          </button>
                          <button
                            type="button"
                            onClick={() => void save("activate", { popupId: entry.id })}
                            className="px-2 py-1 rounded-md bg-primary/15 text-[10px] font-bold text-primary"
                          >
                            Usar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SliderControl(props: {
  label: string
  min: number
  max: number
  value: number
  leftHint: string
  rightHint: string
  onChange: (value: number) => void
}) {
  const decrease = () => {
    props.onChange(Math.max(props.min, Math.round(props.value) - 1))
  }

  const increase = () => {
    props.onChange(Math.min(props.max, Math.round(props.value) + 1))
  }

  return (
    <div className="rounded-xl border border-border/30 bg-surface/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-foreground font-bold">{props.label}</span>
        <div className="inline-flex items-center rounded-lg border border-border/30 bg-background/70 p-0.5">
          <button
            type="button"
            onClick={decrease}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            aria-label={`Reducir ${props.label}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={increase}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            aria-label={`Aumentar ${props.label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Slider
        min={props.min}
        max={props.max}
        step={1}
        value={[props.value]}
        onValueChange={(next) => props.onChange(next[0] ?? props.value)}
        className="w-full py-1 [&_[data-slot=slider-track]]:h-2.5 [&_[data-slot=slider-track]]:rounded-full [&_[data-slot=slider-track]]:bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.14)_100%)] [&_[data-slot=slider-range]]:bg-[linear-gradient(90deg,#93c100_0%,#d1fe17_55%,#ecff97_100%)] [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-black/40 [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(209,254,23,0.18)] [&_[data-slot=slider-thumb]]:transition-all [&_[data-slot=slider-thumb]]:hover:scale-110 [&_[data-slot=slider-thumb]]:hover:shadow-[0_0_0_7px_rgba(209,254,23,0.14)]"
      />

      <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/85">
        <span>{props.leftHint}</span>
        <span>{props.rightHint}</span>
      </div>
    </div>
  )
}
