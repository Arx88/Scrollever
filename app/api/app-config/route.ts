import { NextResponse } from "next/server"
import { getPublicRuntimeConfig } from "@/lib/admin/public-config"

export async function GET() {
  const config = await getPublicRuntimeConfig()
  return NextResponse.json(config)
}
