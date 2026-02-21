import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const addItemSchema = z.object({
  imageId: z.string().uuid(),
  note: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
})

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 120)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 120
  }
  return Math.min(300, Math.floor(parsed))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

  const { data, error } = await supabase
    .from("board_items")
    .select("id,board_id,image_id,added_by,note,sort_order,created_at")
    .eq("board_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[boards/items] fetch_error", error)
    return NextResponse.json({ error: "Failed to load board items" }, { status: 500 })
  }

  const imageIds = (data ?? []).map((item) => item.image_id)
  const { data: images } = imageIds.length
    ? await supabase
        .from("images")
        .select("id,url,prompt,title,created_at,generation_model,generation_provider")
        .in("id", imageIds)
    : { data: [] as Array<any> }

  const imagesById = new Map((images ?? []).map((image) => [image.id, image]))

  return NextResponse.json({
    items: (data ?? []).map((item) => ({
      id: item.id,
      boardId: item.board_id,
      imageId: item.image_id,
      addedBy: item.added_by,
      note: item.note,
      sortOrder: item.sort_order,
      createdAt: item.created_at,
      image: imagesById.get(item.image_id) ?? null,
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = addItemSchema.safeParse(await request.json())
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
  const { data, error } = await supabase
    .from("board_items")
    .upsert(
      {
        board_id: id,
        image_id: payload.imageId,
        added_by: authData.user.id,
        note: payload.note ?? null,
        sort_order: payload.sortOrder ?? 0,
      },
      { onConflict: "board_id,image_id" }
    )
    .select("id,board_id,image_id,added_by,note,sort_order,created_at")
    .single()

  if (error || !data) {
    console.error("[boards/items] add_error", error)
    return NextResponse.json({ error: "Failed to save image in board" }, { status: 500 })
  }

  await supabase
    .from("boards")
    .update({ cover_image_id: payload.imageId })
    .eq("id", id)
    .is("cover_image_id", null)

  return NextResponse.json({ item: data }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const imageId = request.nextUrl.searchParams.get("imageId")
  if (!imageId) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("board_items")
    .delete()
    .eq("board_id", id)
    .eq("image_id", imageId)

  if (error) {
    console.error("[boards/items] delete_error", error)
    return NextResponse.json({ error: "Failed to remove image from board" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
