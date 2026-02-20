import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminRole, normalizeRole } from "@/lib/admin/roles"

interface AdminPageContext {
  userId: string
  username: string
  role: "admin" | "owner"
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function requireAdminPageContext(): Promise<AdminPageContext> {
  if (!isSupabaseConfigured()) {
    redirect("/auth/login")
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    redirect("/auth/login")
  }

  const user = authData.user
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username,role")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[admin/page] profile_query_error", error)
    redirect("/")
  }

  const role = normalizeRole(profile?.role)
  if (!isAdminRole(role)) {
    redirect("/")
  }

  const username = profile?.username?.trim() || user.email?.split("@")[0] || "admin"

  return {
    userId: user.id,
    username,
    role: role === "owner" ? "owner" : "admin",
  }
}
