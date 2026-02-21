export interface GenerationProviderRequest {
  providerKey: string
  modelKey: string
  prompt: string
  negativePrompt: string | null
  aspectRatio: string
}

export interface GenerationProviderResult {
  status: "succeeded" | "failed"
  imageUrl: string | null
  width: number | null
  height: number | null
  metadata: Record<string, unknown>
  errorMessage: string | null
}

export interface GenerationProviderAdapter {
  providerKey: string
  generate: (request: GenerationProviderRequest) => Promise<GenerationProviderResult>
}
