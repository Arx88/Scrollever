"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ImageCard } from "./image-card"
import { mapApiImageToAIImage, type AIImage, type ApiImage } from "@/lib/image-data"
import { useInteractions } from "@/lib/interactions-context"

const scrollPhrases = [
  "Si no scrolleas, no existes.",
  "La IA nunca duerme. Tu tampoco.",
  "El scroll es un estilo de vida.",
  "Cada pixel fue pensado por una maquina.",
  "Las imagenes luchan por sobrevivir.",
  "Solo las mejores quedan para siempre.",
  "Tu like decide quien vive y quien muere.",
  "El algoritmo tiene buen gusto. Y tu?",
  "Infinito es poco para describir esto.",
  "Descubriendo lo que no existia...",
  "El futuro visual esta cargando.",
  "No pares. La IA tampoco para.",
  "Cada scroll es un nuevo universo.",
  "Las sobrevivientes te estan esperando.",
]

interface MasonryGridProps {
  activeCategory: string
  onImageClick: (image: AIImage) => void
}

interface ImagesApiResponse {
  items: ApiImage[]
  nextCursor: string | null
}

const imagesPerPage = 20
const FEED_CACHE_TTL_MS = 30_000

interface FeedCacheEntry {
  items: AIImage[]
  cursor: string | null
  hasMore: boolean
  savedAt: number
}

const feedCache = new Map<string, FeedCacheEntry>()

function randomPhrase() {
  return scrollPhrases[Math.floor(Math.random() * scrollPhrases.length)]
}

export function MasonryGrid({ activeCategory, onImageClick }: MasonryGridProps) {
  const [displayedImages, setDisplayedImages] = useState<AIImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [currentPhrase, setCurrentPhrase] = useState(scrollPhrases[0])
  const loaderRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const displayedImagesRef = useRef<AIImage[]>([])
  const lastRequestRef = useRef<{ key: string; at: number } | null>(null)

  const { registerImages } = useInteractions()

  const fetchImages = useCallback(
    async ({ reset, cursorValue }: { reset: boolean; cursorValue?: string | null }) => {
      if (isFetchingRef.current) {
        return
      }

      if (!reset && !hasMoreRef.current) {
        return
      }

      const requestKey = `${activeCategory}:${reset ? "reset" : "page"}:${cursorValue ?? "null"}`
      const now = Date.now()
      if (lastRequestRef.current?.key === requestKey && now - lastRequestRef.current.at < 750) {
        return
      }
      lastRequestRef.current = { key: requestKey, at: now }

      isFetchingRef.current = true
      setLoading(true)
      setError(null)
      setCurrentPhrase(randomPhrase())

      try {
        const params = new URLSearchParams({
          feed: "recent",
          limit: String(imagesPerPage),
        })

        if (activeCategory !== "En llamas") {
          params.set("category", activeCategory)
        }

        if (!reset && cursorValue) {
          params.set("cursor", cursorValue)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        let response: Response
        try {
          response = await fetch(`/api/images?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (!response.ok) {
          throw new Error("feed_request_failed")
        }

        const payload = (await response.json()) as ImagesApiResponse
        const mappedImages = (payload.items ?? []).map((image) => mapApiImageToAIImage(image))

        registerImages(mappedImages)

        const nextDisplayedImages = reset
          ? mappedImages
          : [...displayedImagesRef.current, ...mappedImages]
        displayedImagesRef.current = nextDisplayedImages
        setDisplayedImages(nextDisplayedImages)

        const nextCursor = payload.nextCursor ?? null
        const nextHasMore = Boolean(nextCursor)
        setCursor(nextCursor)
        setHasMore(nextHasMore)
        hasMoreRef.current = nextHasMore
        feedCache.set(activeCategory, {
          items: nextDisplayedImages,
          cursor: nextCursor,
          hasMore: nextHasMore,
          savedAt: Date.now(),
        })
      } catch {
        setError("No se pudo cargar el feed. Reintenta.")
        if (reset) {
          displayedImagesRef.current = []
          setDisplayedImages([])
          setCursor(null)
          setHasMore(false)
          hasMoreRef.current = false
          feedCache.delete(activeCategory)
        }
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [activeCategory, registerImages]
  )
  const fetchImagesRef = useRef(fetchImages)

  useEffect(() => {
    fetchImagesRef.current = fetchImages
  }, [fetchImages])

  useEffect(() => {
    displayedImagesRef.current = displayedImages
  }, [displayedImages])

  useEffect(() => {
    const cacheEntry = feedCache.get(activeCategory)

    if (cacheEntry && Date.now() - cacheEntry.savedAt <= FEED_CACHE_TTL_MS) {
      displayedImagesRef.current = cacheEntry.items
      setDisplayedImages(cacheEntry.items)
      setCursor(cacheEntry.cursor)
      setHasMore(cacheEntry.hasMore)
      hasMoreRef.current = cacheEntry.hasMore
      setError(null)
      return
    }

    displayedImagesRef.current = []
    setDisplayedImages([])
    setCursor(null)
    setHasMore(true)
    hasMoreRef.current = true
    void fetchImagesRef.current({ reset: true, cursorValue: null })
  }, [activeCategory])

  useEffect(() => {
    if (!loaderRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loading &&
          hasMore &&
          cursor &&
          displayedImagesRef.current.length > 0
        ) {
          void fetchImages({ reset: false, cursorValue: cursor })
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [cursor, fetchImages, hasMore, loading])

  return (
    <div className="px-1.5 md:px-3 lg:px-4 pt-[72px] pb-16">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-2">
        {displayedImages.map((image, index) => (
          <div
            key={image.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${(index % imagesPerPage) * 30}ms` }}
          >
            <div className="relative aspect-[9/16] rounded-lg md:rounded-xl overflow-hidden">
              <ImageCard
                image={image}
                index={index % imagesPerPage}
                onImageClick={onImageClick}
              />
            </div>
          </div>
        ))}
      </div>

      <div ref={loaderRef} className="flex flex-col items-center justify-center py-16 gap-4">
        {loading ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm text-muted-foreground font-display font-extrabold uppercase tracking-wider text-center px-8">
              {currentPhrase}
            </p>
          </>
        ) : error ? (
          <>
            <p className="text-xs text-destructive font-bold uppercase tracking-wider">{error}</p>
            <button
              type="button"
              onClick={() => void fetchImages({ reset: displayedImages.length === 0, cursorValue: cursor })}
              className="px-3 py-1.5 rounded-lg bg-surface text-foreground text-xs font-bold uppercase tracking-wide"
            >
              Reintentar
            </button>
          </>
        ) : hasMore ? (
          <p className="text-xs text-muted-foreground/30 font-mono uppercase tracking-[0.3em]">scroll = life</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">fin del feed</p>
        )}
      </div>
    </div>
  )
}

