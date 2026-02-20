import { NextRequest, NextResponse } from "next/server"
import { adminApiErrorResponse, requireAdminApiContext } from "@/lib/admin/api-auth"

export async function GET(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(request, { allowModerator: true })

    return NextResponse.json({
      user: {
        id: context.userId,
        username: context.username,
        role: context.role,
      },
    })
  } catch (error) {
    return adminApiErrorResponse(error)
  }
}
