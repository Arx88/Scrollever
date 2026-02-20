import { NextRequest, NextResponse } from "next/server"
import { adminApiErrorResponse, requireAdminApiContext } from "@/lib/admin/api-auth"

function safeCount(value: number | null | undefined) {
  return typeof value === "number" ? value : 0
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })
    const since24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      usersRes,
      activeImagesRes,
      immortalImagesRes,
      hallOfFameRes,
      likes24hRes,
      superlikes24hRes,
      pendingRes,
    ] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("images").select("id", { count: "exact", head: true }).is("deleted_at", null),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_immortal", true),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_hall_of_fame", true),
      context.supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("superlikes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24hIso),
      context.supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_immortal", false),
    ])

    return NextResponse.json({
      usersTotal: safeCount(usersRes.count),
      imagesActive: safeCount(activeImagesRes.count),
      imagesPending: safeCount(pendingRes.count),
      immortalImages: safeCount(immortalImagesRes.count),
      hallOfFameImages: safeCount(hallOfFameRes.count),
      likes24h: safeCount(likes24hRes.count),
      superlikes24h: safeCount(superlikes24hRes.count),
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
