import { getRandomMockGeneratedImage } from "@/lib/generation/mock-image"
import type {
  GenerationProviderAdapter,
  GenerationProviderRequest,
  GenerationProviderResult,
} from "@/lib/generation/providers/types"

async function generateMockImage(request: GenerationProviderRequest): Promise<GenerationProviderResult> {
  const image = await getRandomMockGeneratedImage()
  return {
    status: "succeeded",
    imageUrl: image.url,
    width: image.width,
    height: image.height,
    metadata: {
      mocked: true,
      providerKey: request.providerKey,
      modelKey: request.modelKey,
      aspectRatio: request.aspectRatio,
    },
    errorMessage: null,
  }
}

export function createMockAdapter(providerKey: string): GenerationProviderAdapter {
  return {
    providerKey,
    generate: generateMockImage,
  }
}
