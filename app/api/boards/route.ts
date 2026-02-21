import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const createBoardSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  visibility: z.enum(["private", "public", "collab"]).default("private"),
  coverImageId: z.string().uuid().optional().nullable(),
  collaboratorUserIds: z.array(z.string().uuid()).max(24).optional(),
})

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 40)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 40
  }
  return Math.min(100, Math.floor(parsed))
}

async function getBoardsMaxPerUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("app_settings")
    .select("value_json")
    .eq("key", "boards.max_per_user")
    .maybeSingle()

  const parsed = Number(data?.value_json ?? 100)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id ?? null
  const scope = request.nextUrl.searchParams.get("scope")
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

  let query = supabase
    .from("boards")
    .select("id,owner_id,title,description,visibility,cover_image_id,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (scope === "mine" && userId) {
    query = query.eq("owner_id", userId)
  } else if (scope === "public") {
    query = query.eq("visibility", "public")
  }

  const { data: boards, error } = await query
  if (error) {
    console.error("[boards] fetch_error", error)
    return NextResponse.json({ error: "Failed to load boards" }, { status: 500 })
  }

  const ownerIds = Array.from(new Set((boards ?? []).map((board) => board.owner_id)))
  const boardIds = (boards ?? []).map((board) => board.id)

  const [{ data: owners }, { data: items }, { data: covers }] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("id,username").in("id", ownerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }> }),
    boardIds.length
      ? supabase.from("board_items").select("board_id").in("board_id", boardIds)
      : Promise.resolve({ data: [] as Array<{ board_id: string }> }),
    boardIds.length
      ? supabase.from("images").select("id,url").in(
          "id",
          Array.from(
            new Set((boards ?? []).map((board) => board.cover_image_id).filter(Boolean))
          ) as string[]
        )
      : Promise.resolve({ data: [] as Array<{ id: string; url: string }> }),
  ])

  const ownerMap = new Map((owners ?? []).map((owner) => [owner.id, owner.username ?? "anon"]))
  const boardCounts = new Map<string, number>()
  for (const item of items ?? []) {
    boardCounts.set(item.board_id, (boardCounts.get(item.board_id) ?? 0) + 1)
  }
  const coverMap = new Map((covers ?? []).map((cover) => [cover.id, cover.url]))

  return NextResponse.json({
    items: (boards ?? []).map((board) => ({
      id: board.id,
      ownerId: board.owner_id,
      ownerUsername: ownerMap.get(board.owner_id) ?? "anon",
      title: board.title,
      description: board.description,
      visibility: board.visibility,
      coverImageId: board.cover_image_id,
      coverImageUrl: board.cover_image_id ? coverMap.get(board.cover_image_id) ?? null : null,
      itemCount: boardCounts.get(board.id) ?? 0,
      createdAt: board.created_at,
      updatedAt: board.updated_at,
      canEdit: Boolean(userId && board.owner_id === userId),
    })),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = authData.user.id
  const parsed = createBoardSchema.safeParse(await request.json())
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
  const maxBoards = await getBoardsMaxPerUser(supabase)
  const { count } = await supabase
    .from("boards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)

  if ((count ?? 0) >= maxBoards) {
    return NextResponse.json(
      {
        error: "Boards limit reached",
        code: "BOARDS_LIMIT_REACHED",
        maxBoards,
      },
      { status: 429 }
    )
  }

  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      owner_id: userId,
      title: payload.title,
      description: payload.description ?? null,
      visibility: payload.visibility,
      cover_image_id: payload.coverImageId ?? null,
    })
    .select("id,owner_id,title,description,visibility,cover_image_id,created_at,updated_at")
    .single()

  if (error || !board) {
    console.error("[boards] create_error", error)
    return NextResponse.json({ error: "Failed to create board" }, { status: 500 })
  }

  if (payload.visibility === "collab" && payload.collaboratorUserIds?.length) {
    const uniqueCollaborators = Array.from(
      new Set(payload.collaboratorUserIds.filter((id) => id !== userId))
    )
    if (uniqueCollaborators.length > 0) {
      const memberships = uniqueCollaborators.map((collaboratorId) => ({
        board_id: board.id,
        user_id: collaboratorId,
        role: "editor",
      }))
      await supabase.from("board_members").upsert(memberships, { onConflict: "board_id,user_id" })
    }
  }

  return NextResponse.json(
    {
      item: {
        id: board.id,
        ownerId: board.owner_id,
        title: board.title,
        description: board.description,
        visibility: board.visibility,
        coverImageId: board.cover_image_id,
        createdAt: board.created_at,
        updatedAt: board.updated_at,
      },
    },
    { status: 201 }
  )
}
