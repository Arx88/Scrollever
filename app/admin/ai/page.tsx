"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, KeyRound, Save, Sparkles } from "lucide-react"

interface ProviderItem {
  providerKey: string
  displayName: string
  apiBaseUrl: string | null
  hasApiKey: boolean
  isEnabled: boolean
  defaultModelKey: string | null
  metadata: Record<string, unknown>
  updatedAt: string | null
}

interface ModelItem {
  id: string
  providerKey: string
  modelKey: string
  displayName: string
  description: string | null
  isEnabled: boolean
  isPublic: boolean
  sortOrder: number
  maxResolution: number
  supportsImageToImage: boolean
  supportsInpainting: boolean
  supportsControlnet: boolean
  metadata: Record<string, unknown>
  updatedAt: string | null
}

export default function AdminAiPage() {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [models, setModels] = useState<ModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>({})

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [providersResponse, modelsResponse] = await Promise.all([
          fetch("/api/admin/ai/providers", { cache: "no-store" }),
          fetch("/api/admin/ai/models", { cache: "no-store" }),
        ])

        if (!providersResponse.ok || !modelsResponse.ok) {
          throw new Error("ai_admin_request_failed")
        }

        const providersPayload = (await providersResponse.json()) as { items: ProviderItem[] }
        const modelsPayload = (await modelsResponse.json()) as { items: ModelItem[] }

        if (!mounted) {
          return
        }

        setProviders(providersPayload.items)
        setModels(modelsPayload.items)
      } catch {
        if (mounted) {
          setError("No se pudo cargar la configuracion AI")
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

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, ModelItem[]>()
    for (const model of models) {
      const list = map.get(model.providerKey) ?? []
      list.push(model)
      map.set(model.providerKey, list)
    }
    return map
  }, [models])

  const saveProvider = async (provider: ProviderItem) => {
    const id = `provider:${provider.providerKey}`
    setSavingKey(id)
    setError(null)

    try {
      const response = await fetch("/api/admin/ai/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey: provider.providerKey,
          displayName: provider.displayName,
          apiBaseUrl: provider.apiBaseUrl,
          apiKey: providerApiKeys[provider.providerKey]
            ? providerApiKeys[provider.providerKey]
            : undefined,
          isEnabled: provider.isEnabled,
          defaultModelKey: provider.defaultModelKey,
          metadata: provider.metadata,
        }),
      })

      if (!response.ok) {
        throw new Error("provider_save_failed")
      }

      const payload = (await response.json()) as { item: ProviderItem }
      setProviders((prev) =>
        prev.map((entry) => (entry.providerKey === provider.providerKey ? payload.item : entry))
      )
      setProviderApiKeys((prev) => ({ ...prev, [provider.providerKey]: "" }))
    } catch {
      setError(`No se pudo guardar provider ${provider.providerKey}`)
    } finally {
      setSavingKey(null)
    }
  }

  const saveModel = async (model: ModelItem) => {
    const id = `model:${model.modelKey}`
    setSavingKey(id)
    setError(null)

    try {
      const response = await fetch("/api/admin/ai/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model),
      })

      if (!response.ok) {
        throw new Error("model_save_failed")
      }

      const payload = (await response.json()) as { item: ModelItem }
      setModels((prev) =>
        prev.map((entry) => (entry.modelKey === model.modelKey ? payload.item : entry))
      )
    } catch {
      setError(`No se pudo guardar modelo ${model.modelKey}`)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10">
          <p className="text-xs font-bold text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border/20 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 bg-surface flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Providers Globales</p>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="h-16 w-full rounded bg-background animate-pulse" />
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {providers.map((provider) => {
              const busy = savingKey === `provider:${provider.providerKey}`
              const linkedModels = modelsByProvider.get(provider.providerKey) ?? []
              return (
                <div key={provider.providerKey} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{provider.displayName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{provider.providerKey}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveProvider(provider)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wide disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Display
                      <input
                        type="text"
                        value={provider.displayName}
                        onChange={(event) => {
                          const displayName = event.target.value
                          setProviders((prev) =>
                            prev.map((entry) =>
                              entry.providerKey === provider.providerKey ? { ...entry, displayName } : entry
                            )
                          )
                        }}
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      API Base URL
                      <input
                        type="text"
                        value={provider.apiBaseUrl ?? ""}
                        onChange={(event) => {
                          const apiBaseUrl = event.target.value.trim() ? event.target.value : null
                          setProviders((prev) =>
                            prev.map((entry) =>
                              entry.providerKey === provider.providerKey ? { ...entry, apiBaseUrl } : entry
                            )
                          )
                        }}
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                        placeholder="https://api.provider.com"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      API Key (global)
                      <input
                        type="password"
                        value={providerApiKeys[provider.providerKey] ?? ""}
                        onChange={(event) =>
                          setProviderApiKeys((prev) => ({
                            ...prev,
                            [provider.providerKey]: event.target.value,
                          }))
                        }
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                        placeholder={provider.hasApiKey ? "******** guardada" : "pega la key"}
                      />
                    </label>

                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={provider.isEnabled}
                          onChange={(event) => {
                            const isEnabled = event.target.checked
                            setProviders((prev) =>
                              prev.map((entry) =>
                                entry.providerKey === provider.providerKey ? { ...entry, isEnabled } : entry
                              )
                            )
                          }}
                        />
                        Provider habilitado
                      </label>

                      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Modelo default
                        <select
                          value={provider.defaultModelKey ?? ""}
                          onChange={(event) => {
                            const defaultModelKey = event.target.value || null
                            setProviders((prev) =>
                              prev.map((entry) =>
                                entry.providerKey === provider.providerKey
                                  ? { ...entry, defaultModelKey }
                                  : entry
                              )
                            )
                          }}
                          className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                        >
                          <option value="">Sin default</option>
                          {linkedModels.map((model) => (
                            <option key={model.modelKey} value={model.modelKey}>
                              {model.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/20 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 bg-surface flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Modelos AI</p>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="h-16 w-full rounded bg-background animate-pulse" />
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {models.map((model) => {
              const busy = savingKey === `model:${model.modelKey}`
              return (
                <div key={model.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{model.displayName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {model.providerKey} / {model.modelKey}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveModel(model)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wide disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {busy ? "Guardando..." : "Guardar"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Display
                      <input
                        type="text"
                        value={model.displayName}
                        onChange={(event) => {
                          const displayName = event.target.value
                          setModels((prev) =>
                            prev.map((entry) =>
                              entry.modelKey === model.modelKey ? { ...entry, displayName } : entry
                            )
                          )
                        }}
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Sort
                      <input
                        type="number"
                        value={model.sortOrder}
                        onChange={(event) => {
                          const sortOrder = Number(event.target.value || 0)
                          setModels((prev) =>
                            prev.map((entry) =>
                              entry.modelKey === model.modelKey ? { ...entry, sortOrder } : entry
                            )
                          )
                        }}
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Max res
                      <input
                        type="number"
                        value={model.maxResolution}
                        onChange={(event) => {
                          const maxResolution = Number(event.target.value || 2048)
                          setModels((prev) =>
                            prev.map((entry) =>
                              entry.modelKey === model.modelKey ? { ...entry, maxResolution } : entry
                            )
                          )
                        }}
                        className="px-3 py-2 rounded-lg border border-border/30 bg-background text-sm text-foreground normal-case tracking-normal"
                      />
                    </label>

                    <label className="inline-flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={model.isEnabled}
                        onChange={(event) => {
                          const isEnabled = event.target.checked
                          setModels((prev) =>
                            prev.map((entry) =>
                              entry.modelKey === model.modelKey ? { ...entry, isEnabled } : entry
                            )
                          )
                        }}
                      />
                      Habilitado
                    </label>

                    <label className="inline-flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={model.isPublic}
                        onChange={(event) => {
                          const isPublic = event.target.checked
                          setModels((prev) =>
                            prev.map((entry) =>
                              entry.modelKey === model.modelKey ? { ...entry, isPublic } : entry
                            )
                          )
                        }}
                      />
                      Publico
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary" />
                      i2i: {model.supportsImageToImage ? "si" : "no"}
                    </span>
                    <span>inpaint: {model.supportsInpainting ? "si" : "no"}</span>
                    <span>controlnet: {model.supportsControlnet ? "si" : "no"}</span>
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
