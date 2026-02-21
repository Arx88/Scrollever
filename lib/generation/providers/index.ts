import { createMockAdapter } from "@/lib/generation/providers/mock"
import type {
  GenerationProviderAdapter,
  GenerationProviderRequest,
  GenerationProviderResult,
} from "@/lib/generation/providers/types"

const PROVIDER_ADAPTERS: Record<string, GenerationProviderAdapter> = {
  openai: createMockAdapter("openai"),
  stability: createMockAdapter("stability"),
  nanobanana: createMockAdapter("nanobanana"),
  flux: createMockAdapter("flux"),
}

export function resolveProviderAdapter(providerKey: string): GenerationProviderAdapter {
  return PROVIDER_ADAPTERS[providerKey] ?? createMockAdapter(providerKey)
}

export async function generateImageWithProvider(
  request: GenerationProviderRequest
): Promise<GenerationProviderResult> {
  const adapter = resolveProviderAdapter(request.providerKey)
  return adapter.generate(request)
}
