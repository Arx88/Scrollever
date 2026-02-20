"use client"

import { useEffect, useState } from "react"

interface AdminFeatureFlag {
  key: string
  description: string
  isPublic: boolean
  enabled: boolean
  rollout: number
  source: string
  updatedAt: string | null
}

export default function AdminFlagsPage() {
  const [items, setItems] = useState<AdminFeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/feature-flags", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("flags_request_failed")
        }

        const payload = (await response.json()) as { items: AdminFeatureFlag[] }
        if (mounted) {
          setItems(payload.items)
        }
      } catch {
        if (mounted) {
          setError("No se pudieron cargar los feature flags")
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

  const saveFlag = async (item: AdminFeatureFlag) => {
    setSavingKey(item.key)
    setError(null)
    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: item.key,
          enabled: item.enabled,
          rollout: item.rollout,
        }),
      })

      if (!response.ok) {
        throw new Error("flag_update_failed")
      }
    } catch {
      setError(`No se pudo guardar ${item.key}`)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10">
          <p className="text-xs font-bold text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border/20 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 bg-surface">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Feature Flags</p>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="h-16 w-full rounded bg-background animate-pulse" />
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {items.map((item) => {
              const busy = savingKey === item.key
              return (
                <div key={item.key} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.key}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{item.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        publico: {item.isPublic ? "si" : "no"} · source: {item.source}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveFlag(item)}
                      disabled={busy}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wide disabled:opacity-60"
                    >
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(event) => {
                          const enabled = event.target.checked
                          setItems((prev) =>
                            prev.map((entry) => (entry.key === item.key ? { ...entry, enabled } : entry))
                          )
                        }}
                      />
                      {item.enabled ? "Enabled" : "Disabled"}
                    </label>

                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      Rollout
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.rollout}
                        onChange={(event) => {
                          const rollout = Math.max(0, Math.min(100, Number(event.target.value || 0)))
                          setItems((prev) =>
                            prev.map((entry) => (entry.key === item.key ? { ...entry, rollout } : entry))
                          )
                        }}
                        className="w-24 px-2 py-1 rounded border border-border/30 bg-background text-foreground text-sm"
                      />
                      %
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
