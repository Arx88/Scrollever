import { NextRequest, NextResponse } from "next/server"
import { adminApiErrorResponse, requireAdminApiContext } from "@/lib/admin/api-auth"

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 50)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50
  }

  return Math.min(100, Math.floor(parsed))
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

    const { data, error } = await context.supabase
      .from("admin_audit_logs")
      .select("id,actor_id,action,resource_type,resource_id,payload,created_at,ip,user_agent")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[admin/audit] fetch_error", error)
      return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 })
    }

    const actorIds = Array.from(new Set((data ?? []).map((item) => item.actor_id).filter(Boolean)))
    const { data: profiles } = actorIds.length
      ? await context.supabase
          .from("profiles")
          .select("id,username")
          .in("id", actorIds)
      : { data: [] as Array<{ id: string; username: string | null }> }

    const usernamesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username ?? "unknown"]))

    const items = (data ?? []).map((item) => ({
      ...item,
      actor_username: usernamesById.get(item.actor_id) ?? "unknown",
    }))

    return NextResponse.json({
      items,
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
