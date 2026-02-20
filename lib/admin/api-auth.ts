import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminRole, isModeratorRole, normalizeRole, type AppRole } from "@/lib/admin/roles"

export interface AdminApiContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  username: string
  role: AppRole
  ip: string | null
  userAgent: string | null
}

interface RequireAdminApiOptions {
  allowModerator?: boolean
}

export class AdminApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function adminApiErrorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    )
  }

  console.error("[admin] unexpected_error", error)
  return NextResponse.json(
    {
      error: "Internal server error",
      code: "ADMIN_INTERNAL_ERROR",
    },
    { status: 500 }
  )
}

export async function requireAdminApiContext(
  request: NextRequest,
  options?: RequireAdminApiOptions
): Promise<AdminApiContext> {
  if (!isSupabaseConfigured()) {
    throw new AdminApiError(503, "SUPABASE_NOT_CONFIGURED", "Supabase is not configured")
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) {
    throw new AdminApiError(401, "ADMIN_UNAUTHORIZED", "Could not validate user session")
  }

  const user = authData.user
  if (!user) {
    throw new AdminApiError(401, "ADMIN_UNAUTHORIZED", "Authentication required")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username,role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[admin] profile_query_error", profileError)
    throw new AdminApiError(500, "ADMIN_PROFILE_ERROR", "Failed to resolve admin profile")
  }

  const role = normalizeRole(profile?.role)
  const isAllowed = options?.allowModerator ? isModeratorRole(role) : isAdminRole(role)

  if (!isAllowed) {
    throw new AdminApiError(403, "ADMIN_FORBIDDEN", "Admin permissions required")
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null
  const userAgent = request.headers.get("user-agent")
  const username = profile?.username?.trim() || user.email?.split("@")[0] || "admin"

  return {
    supabase,
    userId: user.id,
    username,
    role,
    ip,
    userAgent,
  }
}

export async function logAdminAudit(
  context: AdminApiContext,
  action: string,
  resourceType: string,
  resourceId: string | null,
  payload: Record<string, unknown>
) {
  const { error } = await context.supabase.from("admin_audit_logs").insert({
    actor_id: context.userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    payload,
    ip: context.ip,
    user_agent: context.userAgent,
  })

  if (error) {
    console.error("[admin] audit_insert_error", error)
  }
}
