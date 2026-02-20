"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { ImageModal } from "@/components/image-modal"
import { ImageCard } from "@/components/image-card"
import { mapApiImageToAIImage, type AIImage, type ApiImage } from "@/lib/image-data"
import { useInteractions } from "@/lib/interactions-context"
import { Crown, Trophy, Star } from "lucide-react"

interface ImagesApiResponse {
  items: ApiImage[]
}

export default function HallOfFamePage() {
  const [selectedImage, setSelectedImage] = useState<AIImage | null>(null)
  const [hallOfFameImages, setHallOfFameImages] = useState<AIImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { registerImages } = useInteractions()

  useEffect(() => {
    let mounted = true

    const loadHallOfFame = async () => {
      setLoading(true)
      setError(null)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch("/api/images?feed=hall-of-fame&limit=50", {
          cache: "no-store",
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error("hall_of_fame_request_failed")
        }

        const payload = (await response.json()) as ImagesApiResponse
        const mapped = (payload.items ?? []).map((image) => mapApiImageToAIImage(image))

        if (!mounted) {
          return
        }

        registerImages(mapped)
        setHallOfFameImages(mapped)
      } catch {
        if (!mounted) {
          return
        }

        setError("No se pudo cargar Hall of Fame")
        setHallOfFameImages([])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadHallOfFame()

    return () => {
      mounted = false
    }
  }, [registerImages])

  const sortedImages = useMemo(() => {
    return [...hallOfFameImages].sort((a, b) => {
      if (b.superlikes !== a.superlikes) {
        return b.superlikes - a.superlikes
      }
      if (b.likes !== a.likes) {
        return b.likes - a.likes
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [hallOfFameImages])

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="px-4 md:px-6 lg:px-8 pt-[72px] pb-24">
        <div className="max-w-3xl mx-auto text-center pt-8 pb-10 md:pt-12 md:pb-14">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Crown className="w-6 h-6 text-amber-400" />
            <Trophy className="w-8 h-8 text-amber-400" />
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-foreground uppercase tracking-tight mb-3 text-balance">
            Hall of Fame
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Las imagenes que la comunidad considero legendarias. Consagradas para siempre por superlikes.
          </p>

          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono text-foreground/70">
                <span className="text-amber-400 font-bold">{sortedImages.length}</span> legendarias
              </span>
            </div>
            <div className="w-px h-4 bg-border/30" />
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono text-foreground/70">
                <span className="text-amber-400 font-bold">
                  {sortedImages.reduce((sum, img) => sum + img.superlikes, 0)}
                </span>{" "}
                superlikes totales
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">Cargando Hall of Fame...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-destructive text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-surface text-foreground text-xs font-bold uppercase tracking-wide"
            >
              Reintentar
            </button>
          </div>
        ) : sortedImages.length > 0 ? (
          <div className="max-w-6xl mx-auto">
            {sortedImages.length >= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4">
                {sortedImages.slice(0, 3).map((image, i) => (
                  <div key={image.id} className="relative">
                    <div
                      className={`absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                        i === 0
                          ? "bg-amber-500/90 text-black"
                          : i === 1
                            ? "bg-gray-300/90 text-black"
                            : "bg-amber-700/90 text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold font-mono">#{i + 1}</span>
                      <Star className={`w-3 h-3 ${i === 0 ? "fill-black" : ""}`} />
                      <span className="text-[10px] font-bold">{image.superlikes} SL</span>
                    </div>

                    <div className={`aspect-[3/4] ${i === 0 ? "ring-2 ring-amber-500/40" : ""} rounded-xl overflow-hidden`}>
                      <ImageCard
                        image={image}
                        index={i}
                        onImageClick={(img) => setSelectedImage(img)}
                        isFeatured={i === 0}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sortedImages.length > 3 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {sortedImages.slice(3).map((image, i) => (
                  <div key={image.id} className="relative">
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm">
                      <span className="text-[10px] font-bold font-mono text-foreground/80">#{i + 4}</span>
                      <Star className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-400">{image.superlikes}</span>
                    </div>
                    <div className="aspect-[3/4] rounded-xl overflow-hidden">
                      <ImageCard image={image} index={i + 3} onImageClick={(img) => setSelectedImage(img)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <Crown className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Todavia no hay imagenes en el Hall of Fame.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Usa tu superlike diario para nominar imagenes.</p>
          </div>
        )}
      </div>

      <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </main>
  )
}

