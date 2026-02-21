import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const updateBoardSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(["private", "public", "collab"]).optional(),
  coverImageId: z.string().uuid().nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id ?? null

  const { data, error } = await supabase
    .from("boards")
    .select("id,owner_id,title,description,visibility,cover_image_id,created_at,updated_at")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[boards/:id] fetch_error", error)
    return NextResponse.json({ error: "Failed to load board" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 })
  }

  const [{ data: owner }, { data: coverImage }] = await Promise.all([
    supabase.from("profiles").select("id,username").eq("id", data.owner_id).maybeSingle(),
    data.cover_image_id
      ? supabase.from("images").select("id,url").eq("id", data.cover_image_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; url: string } | null }),
  ])

  return NextResponse.json({
    item: {
      id: data.id,
      ownerId: data.owner_id,
      ownerUsername: owner?.username ?? "anon",
      title: data.title,
      description: data.description,
      visibility: data.visibility,
      coverImageId: data.cover_image_id,
      coverImageUrl: coverImage?.url ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      canEdit: Boolean(userId && userId === data.owner_id),
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = updateBoardSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const updatePayload: Record<string, unknown> = {}
  if (payload.title !== undefined) updatePayload.title = payload.title
  if (payload.description !== undefined) updatePayload.description = payload.description
  if (payload.visibility !== undefined) updatePayload.visibility = payload.visibility
  if (payload.coverImageId !== undefined) updatePayload.cover_image_id = payload.coverImageId

  const { data, error } = await supabase
    .from("boards")
    .update(updatePayload)
    .eq("id", id)
    .select("id,owner_id,title,description,visibility,cover_image_id,created_at,updated_at")
    .single()

  if (error) {
    console.error("[boards/:id] update_error", error)
    return NextResponse.json({ error: "Failed to update board" }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
