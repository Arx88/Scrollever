"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { ImageModal } from "@/components/image-modal"
import { ImageCard } from "@/components/image-card"
import { mapApiImageToAIImage, type AIImage, type ApiImage } from "@/lib/image-data"
import { useInteractions } from "@/lib/interactions-context"
import { Crown, Star, Zap } from "lucide-react"

interface ImagesApiResponse {
  items: ApiImage[]
}

const rankStyles = [
  { ring: "ring-2 ring-amber-400/50", badge: "bg-amber-500 text-black", label: "1st" },
  { ring: "ring-1 ring-foreground/20", badge: "bg-foreground/80 text-background", label: "2nd" },
  { ring: "ring-1 ring-amber-700/30", badge: "bg-amber-700/80 text-foreground", label: "3rd" },
]

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

        setError("No se pudo cargar el Hall of Fame")
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

  const totalSuperlikes = sortedImages.reduce((sum, img) => sum + img.superlikes, 0)

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="pt-[72px] pb-24">
        {/* Hero section */}
        <div className="px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto pt-10 pb-12 md:pt-16 md:pb-16">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-display font-extrabold text-foreground uppercase tracking-tight text-balance">
                  Hall of Fame
                </h1>
              </div>
            </div>
            <p className="text-sm md:text-base text-muted-foreground max-w-lg leading-relaxed mb-8">
              Las imagenes que la comunidad consagro como legendarias. Cada superlike es un voto de poder.
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <Crown className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xl font-mono font-bold text-amber-400">{sortedImages.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Legendarias</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border/20">
                <Star className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xl font-mono font-bold text-foreground">{totalSuperlikes}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Superlikes</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border/20">
                <Zap className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xl font-mono font-bold text-primary">1/dia</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tu poder</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-muted-foreground text-sm font-display font-bold uppercase tracking-wider">Cargando leyendas...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive text-sm mb-4 font-bold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-surface text-foreground text-xs font-bold uppercase tracking-wider border border-border/20 hover:bg-surface-hover transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : sortedImages.length > 0 ? (
          <div className="px-3 md:px-6 lg:px-8 max-w-7xl mx-auto">

            {/* Podium: Top 3 */}
            {sortedImages.length >= 1 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-5 px-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">Podio</span>
                  <div className="flex-1 h-px bg-amber-500/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {sortedImages.slice(0, 3).map((image, i) => {
                    const style = rankStyles[i]
                    return (
                      <div key={image.id} className="relative group/podium">
                        {/* Rank badge */}
                        <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg ${style.badge}`}>
                          <span className="text-sm font-display font-extrabold">{style.label}</span>
                          <div className="w-px h-3 bg-current opacity-30" />
                          <div className="flex items-center gap-1">
                            <Star className={`w-3 h-3 ${i === 0 ? "fill-current" : ""}`} />
                            <span className="text-[11px] font-bold font-mono">{image.superlikes}</span>
                          </div>
                        </div>

                        {/* Superlike count overlay */}
                        <div className="absolute top-3 right-3 z-20">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span className="text-xs font-bold font-mono text-amber-400">{image.superlikes}</span>
                          </div>
                        </div>

                        <div className={`aspect-[9/16] ${style.ring} rounded-xl overflow-hidden`}>
                          <ImageCard
                            image={image}
                            index={i}
                            onImageClick={(img) => setSelectedImage(img)}
                          />
                        </div>

                        {/* Bottom info bar */}
                        <div className="mt-2.5 px-1">
                          <p className="text-xs font-bold text-foreground truncate">@{image.author}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{image.prompt.substring(0, 50)}...</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rest of rankings */}
            {sortedImages.length > 3 && (
              <div>
                <div className="flex items-center gap-2 mb-5 px-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Ranking</span>
                  <div className="flex-1 h-px bg-border/20" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {sortedImages.slice(3).map((image, i) => (
                    <div key={image.id} className="relative">
                      {/* Rank number + superlikes */}
                      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono bg-black/70 backdrop-blur-sm text-foreground/80 px-2 py-0.5 rounded-md">
                          #{i + 4}
                        </span>
                        <div className="flex items-center gap-0.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-bold text-amber-400">{image.superlikes}</span>
                        </div>
                      </div>
                      <div className="aspect-[9/16] rounded-xl overflow-hidden">
                        <ImageCard image={image} index={i + 3} onImageClick={(img) => setSelectedImage(img)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 px-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-display font-bold text-lg uppercase tracking-tight mb-2">Todavia no hay leyendas</p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
              Usa tu superlike diario para nominar imagenes. Las mas votadas llegaran aqui.
            </p>
          </div>
        )}
      </div>

      <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </main>
  )
}

