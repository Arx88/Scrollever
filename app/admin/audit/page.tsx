"use client"

import { useEffect, useState } from "react"

interface AdminAuditItem {
  id: string
  actor_id: string
  actor_username: string
  action: string
  resource_type: string
  resource_id: string | null
  payload: Record<string, unknown>
  created_at: string
  ip: string | null
  user_agent: string | null
}

export default function AdminAuditPage() {
  const [items, setItems] = useState<AdminAuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/audit?limit=100", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("audit_request_failed")
        }

        const payload = (await response.json()) as { items: AdminAuditItem[] }
        if (mounted) {
          setItems(payload.items)
        }
      } catch {
        if (mounted) {
          setError("No se pudieron cargar los logs de auditoria")
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

  return (
    <section className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10">
          <p className="text-xs font-bold text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border/20 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/10 bg-surface">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">Audit Logs</p>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="h-16 w-full rounded bg-background animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <p className="text-xs text-muted-foreground">Aun no hay eventos de auditoria.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {items.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-foreground">
                    {item.action} · {item.resource_type}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  actor: @{item.actor_username} · resource_id: {item.resource_id ?? "-"} · ip: {item.ip ?? "-"}
                </p>
                <pre className="mt-2 p-2 rounded bg-background border border-border/20 text-[10px] overflow-x-auto text-muted-foreground">
                  {JSON.stringify(item.payload ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
