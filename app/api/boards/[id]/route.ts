import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, isServiceClientConfigured } from "@/lib/supabase/service"

const updateBoardSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(["private", "public", "collab"]).optional(),
  coverImageId: z.string().uuid().nullable().optional(),
})

interface BoardRow {
  id: string
  owner_id: string
  title: string
  description: string | null
  visibility: "public" | "private" | "collab"
  cover_image_id: string | null
  created_at: string
  updated_at: string
}

const BOARD_SELECT_COLUMNS = "id,owner_id,title,description,visibility,cover_image_id,created_at,updated_at"

function mapBoardResponse(row: BoardRow, extra: { ownerUsername?: string; coverImageUrl?: string | null; canEdit?: boolean } = {}) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerUsername: extra.ownerUsername ?? "anon",
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    coverImageId: row.cover_image_id,
    coverImageUrl: extra.coverImageUrl ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: Boolean(extra.canEdit),
  }
}

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
    .select(BOARD_SELECT_COLUMNS)
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
    item: mapBoardResponse(data as BoardRow, {
      ownerUsername: owner?.username ?? "anon",
      coverImageUrl: coverImage?.url ?? null,
      canEdit: Boolean(userId && userId === data.owner_id),
    }),
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

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const userId = authData.user.id
  let updatedBoard: BoardRow | null = null
  let updateError: { code?: string; message?: string } | null = null

  const firstUpdate = await supabase
    .from("boards")
    .update(updatePayload)
    .eq("owner_id", userId)
    .eq("id", id)
    .select(BOARD_SELECT_COLUMNS)
    .maybeSingle()

  updatedBoard = (firstUpdate.data as BoardRow | null) ?? null
  updateError = firstUpdate.error

  const shouldTryServiceFallback =
    !updatedBoard &&
    (updateError?.code === "42501" || !updateError) &&
    isServiceClientConfigured()

  if (shouldTryServiceFallback) {
    const service = createServiceClient()
    const { data: targetBoard, error: targetError } = await service
      .from("boards")
      .select("id,owner_id")
      .eq("id", id)
      .maybeSingle()

    if (targetError) {
      console.error("[boards/:id] ownership_check_error", targetError)
      return NextResponse.json({ error: "Failed to update board" }, { status: 500 })
    }

    if (!targetBoard) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }

    if (targetBoard.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceUpdate = await service
      .from("boards")
      .update(updatePayload)
      .eq("id", id)
      .select(BOARD_SELECT_COLUMNS)
      .single()

    updatedBoard = (serviceUpdate.data as BoardRow | null) ?? null
    updateError = serviceUpdate.error
  }

  if (!updatedBoard) {
    if (!updateError) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }
    console.error("[boards/:id] update_error", updateError)
    return NextResponse.json(
      {
        error: "Failed to update board",
        code: updateError.code ?? "UNKNOWN",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ item: mapBoardResponse(updatedBoard, { canEdit: true }) })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = authData.user.id

  const firstDelete = await supabase
    .from("boards")
    .delete()
    .eq("owner_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (firstDelete.data?.id) {
    return NextResponse.json({ ok: true, id: firstDelete.data.id })
  }

  const shouldTryServiceFallback =
    (firstDelete.error?.code === "42501" || !firstDelete.error) &&
    isServiceClientConfigured()

  if (shouldTryServiceFallback) {
    const service = createServiceClient()
    const { data: targetBoard, error: targetError } = await service
      .from("boards")
      .select("id,owner_id")
      .eq("id", id)
      .maybeSingle()

    if (targetError) {
      console.error("[boards/:id] delete_ownership_check_error", targetError)
      return NextResponse.json({ error: "Failed to delete board" }, { status: 500 })
    }

    if (!targetBoard) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }

    if (targetBoard.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceDelete = await service
      .from("boards")
      .delete()
      .eq("id", id)
      .select("id")
      .single()

    if (serviceDelete.error || !serviceDelete.data) {
      console.error("[boards/:id] delete_error", serviceDelete.error)
      return NextResponse.json(
        {
          error: "Failed to delete board",
          code: serviceDelete.error?.code ?? "UNKNOWN",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, id: serviceDelete.data.id })
  }

  if (!firstDelete.error) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 })
  }

  console.error("[boards/:id] delete_error", firstDelete.error)
  return NextResponse.json(
    {
      error: "Failed to delete board",
      code: firstDelete.error.code ?? "UNKNOWN",
    },
    { status: 500 }
  )
}
