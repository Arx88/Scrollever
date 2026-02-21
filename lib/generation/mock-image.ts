import { readdir } from "node:fs/promises"
import path from "node:path"

const PROVISIONAL_PATH = path.join(process.cwd(), "public", "provisional")
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])

export interface MockGeneratedImage {
  url: string
  width: number
  height: number
}

export async function getRandomMockGeneratedImage(): Promise<MockGeneratedImage> {
  let files: string[] = []
  try {
    files = await readdir(PROVISIONAL_PATH)
  } catch {
    return {
      url: "/provisional/Imagen%202.png",
      width: 900,
      height: 1600,
    }
  }

  const candidates = files.filter((file) => SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase()))
  if (candidates.length === 0) {
    return {
      url: "/provisional/Imagen%202.png",
      width: 900,
      height: 1600,
    }
  }

  const index = Math.floor(Math.random() * candidates.length)
  return {
    url: `/provisional/${encodeURIComponent(candidates[index] ?? "Imagen 2.png")}`,
    width: 900,
    height: 1600,
  }
}
