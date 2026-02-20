"use client"

import { useEffect, useMemo, useState } from "react"

interface AdminSetting {
  key: string
  category: string
  type: "number" | "boolean" | "string" | "json" | "string_array"
  description: string
  isPublic: boolean
  value: unknown
  source: string
  updatedAt: string | null
}

interface SettingsResponse {
  items: AdminSetting[]
  categories: string[]
}

export default function AdminSettingsPage() {
  const [items, setItems] = useState<AdminSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("settings_request_failed")
        }

        const payload = (await response.json()) as SettingsResponse
        if (!mounted) {
          return
        }

        setItems(payload.items)
        setCategories(payload.categories)
        const nextDrafts: Record<string, string> = {}
        for (const item of payload.items) {
          nextDrafts[item.key] = stringifyValue(item.value, item.type)
        }
        setDrafts(nextDrafts)
      } catch {
        if (mounted) {
          setError("No se pudieron cargar los settings")
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

  const grouped = useMemo(() => {
    const result = new Map<string, AdminSetting[]>()
    for (const category of categories) {
      result.set(category, [])
    }
    for (const item of items) {
      const list = result.get(item.category) ?? []
      list.push(item)
      result.set(item.category, list)
    }
    return result
  }, [categories, items])

  const handleSave = async (item: AdminSetting) => {
    const draft = drafts[item.key] ?? ""
    const parsed = parseDraft(item.type, draft)
    if (!parsed.success) {
      setError(parsed.error)
      return
    }

    setSavingKey(item.key)
    setError(null)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: item.key,
          value: parsed.value,
        }),
      })

      if (!response.ok) {
        throw new Error("settings_update_failed")
      }

      const nextItems = items.map((entry) =>
        entry.key === item.key
          ? {
              ...entry,
              value: parsed.value,
              source: "database",
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
      setItems(nextItems)
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

      {loading ? (
        <div className="rounded-xl border border-border/20 bg-card p-5">
          <div className="h-5 w-44 bg-surface rounded animate-pulse mb-4" />
          <div className="h-20 w-full bg-surface rounded animate-pulse" />
        </div>
      ) : (
        Array.from(grouped.entries()).map(([category, settings]) => (
          <div key={category} className="rounded-xl border border-border/20 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/10 bg-surface">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">{category}</p>
            </div>

            <div className="divide-y divide-border/10">
              {settings.map((item) => {
                const busy = savingKey === item.key
                return (
                  <div key={item.key} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">{item.key}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          tipo: {item.type} · publico: {item.isPublic ? "si" : "no"} · source: {item.source}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSave(item)}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wide disabled:opacity-60"
                      >
                        {busy ? "Guardando..." : "Guardar"}
                      </button>
                    </div>

                    <SettingInput
                      item={item}
                      value={drafts[item.key] ?? ""}
                      onChange={(next) => {
                        setDrafts((prev) => ({
                          ...prev,
                          [item.key]: next,
                        }))
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function SettingInput(props: {
  item: AdminSetting
  value: string
  onChange: (value: string) => void
}) {
  if (props.item.type === "boolean") {
    const checked = props.value === "true"
    return (
      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => props.onChange(String(event.target.checked))}
        />
        {checked ? "Activo" : "Inactivo"}
      </label>
    )
  }

  if (props.item.type === "number") {
    return (
      <input
        type="number"
        step="any"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/30 text-sm text-foreground"
      />
    )
  }

  if (props.item.type === "json" || props.item.type === "string_array") {
    return (
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        rows={3}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/30 text-xs font-mono text-foreground"
      />
    )
  }

  return (
    <input
      type="text"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-background border border-border/30 text-sm text-foreground"
    />
  )
}

function stringifyValue(value: unknown, type: AdminSetting["type"]) {
  if (type === "json" || type === "string_array") {
    try {
      return JSON.stringify(value ?? null)
    } catch {
      return ""
    }
  }

  return String(value ?? "")
}

function parseDraft(type: AdminSetting["type"], draft: string):
  | { success: true; value: unknown }
  | { success: false; error: string } {
  if (type === "number") {
    const value = Number(draft)
    if (!Number.isFinite(value)) {
      return { success: false, error: "Valor numerico invalido" }
    }
    return { success: true, value }
  }

  if (type === "boolean") {
    if (draft !== "true" && draft !== "false") {
      return { success: false, error: "Valor booleano invalido" }
    }
    return { success: true, value: draft === "true" }
  }

  if (type === "string") {
    return { success: true, value: draft.trim() }
  }

  if (type === "json") {
    try {
      return { success: true, value: JSON.parse(draft) }
    } catch {
      return { success: false, error: "JSON invalido" }
    }
  }

  if (type === "string_array") {
    if (draft.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(draft)
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
          return { success: false, error: "Array invalido. Debe ser string[]" }
        }
        return { success: true, value: parsed }
      } catch {
        return { success: false, error: "Array JSON invalido" }
      }
    }

    return {
      success: true,
      value: draft
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    }
  }

  return { success: false, error: "Tipo no soportado" }
}
