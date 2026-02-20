"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { AIImage } from "@/lib/image-data"

interface InteractionsState {
  likes: Set<string>
  superlikes: Set<string>
  dailySuperlikeUsed: boolean
  dailySuperlikeImageId: string | null
  dailySuperlikeResetAt: Date | null
}

interface InteractionsContextType {
  registerImages: (images: AIImage[]) => void
  isLiked: (imageId: string) => boolean
  toggleLike: (imageId: string) => Promise<boolean>
  getLikeCount: (imageId: string) => number
  isSuperliked: (imageId: string) => boolean
  canSuperlike: () => boolean
  addSuperlike: (imageId: string) => Promise<{ success: boolean; error?: string }>
  getSuperlikeCount: (imageId: string) => number
  superlikeResetTime: () => string | null
}

const InteractionsContext = createContext<InteractionsContextType | undefined>(undefined)

function getNextUtcMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}


export function InteractionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InteractionsState>({
    likes: new Set(),
    superlikes: new Set(),
    dailySuperlikeUsed: false,
    dailySuperlikeImageId: null,
    dailySuperlikeResetAt: null,
  })

  const likeBaseRef = useRef(new Map<string, number>())
  const superlikeBaseRef = useRef(new Map<string, number>())
  const likeDeltaRef = useRef(new Map<string, number>())
  const superlikeDeltaRef = useRef(new Map<string, number>())
  const [countVersion, setCountVersion] = useState(0)

  const bumpCountVersion = useCallback(() => {
    setCountVersion((prev) => prev + 1)
  }, [])

  const registerImages = useCallback((images: AIImage[]) => {
    let sawSuperlike = false

    for (const image of images) {
      if (!likeBaseRef.current.has(image.id)) {
        likeBaseRef.current.set(image.id, image.likes)
      }
      if (!superlikeBaseRef.current.has(image.id)) {
        superlikeBaseRef.current.set(image.id, image.superlikes)
      }
      if (image.userSuperliked) {
        sawSuperlike = true
      }
    }

    setState((prev) => {
      const likes = new Set(prev.likes)
      const superlikes = new Set(prev.superlikes)
      let dailySuperlikeUsed = prev.dailySuperlikeUsed
      let dailySuperlikeResetAt = prev.dailySuperlikeResetAt
      let dailySuperlikeImageId = prev.dailySuperlikeImageId

      for (const image of images) {
        if (image.userLiked) {
          likes.add(image.id)
        }

        if (image.userSuperliked) {
          superlikes.add(image.id)
          if (!dailySuperlikeImageId) {
            dailySuperlikeImageId = image.id
          }
        }
      }

      if (sawSuperlike) {
        dailySuperlikeUsed = true
        dailySuperlikeResetAt = dailySuperlikeResetAt ?? getNextUtcMidnight()
      }

      return {
        ...prev,
        likes,
        superlikes,
        dailySuperlikeUsed,
        dailySuperlikeImageId,
        dailySuperlikeResetAt,
      }
    })
  }, [])

  const isLiked = useCallback(
    (imageId: string) => {
      return state.likes.has(imageId)
    },
    [state.likes]
  )

  const getLikeCount = useCallback(
    (imageId: string) => {
      void countVersion
      return likeDeltaRef.current.get(imageId) ?? 0
    },
    [countVersion]
  )

  const toggleLike = useCallback(
    async (imageId: string) => {
      const fallbackState = state.likes.has(imageId)

      try {
        const response = await fetchWithTimeout(
          `/api/images/${imageId}/like`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
          10000
        )

        const payload = await response.json()

        if (!response.ok) {
          return fallbackState
        }

        const liked = Boolean(payload.liked)

        setState((prev) => {
          const likes = new Set(prev.likes)
          if (liked) {
            likes.add(imageId)
          } else {
            likes.delete(imageId)
          }

          return {
            ...prev,
            likes,
          }
        })

        if (typeof payload.likeCount === "number") {
          const base = likeBaseRef.current.get(imageId) ?? payload.likeCount
          likeBaseRef.current.set(imageId, base)
          likeDeltaRef.current.set(imageId, payload.likeCount - base)
          bumpCountVersion()
        }

        return liked
      } catch {
        return fallbackState
      }
    },
    [bumpCountVersion, state.likes]
  )

  const isSuperliked = useCallback(
    (imageId: string) => {
      return state.superlikes.has(imageId)
    },
    [state.superlikes]
  )

  const canSuperlike = useCallback(() => {
    if (!state.dailySuperlikeUsed) {
      return true
    }

    if (state.dailySuperlikeResetAt && new Date() >= state.dailySuperlikeResetAt) {
      return true
    }

    return false
  }, [state.dailySuperlikeResetAt, state.dailySuperlikeUsed])

  const addSuperlike = useCallback(
    async (imageId: string) => {
      if (state.superlikes.has(imageId)) {
        return { success: false, error: "Ya le diste superlike a esta imagen" }
      }

      try {
        const response = await fetchWithTimeout(
          `/api/images/${imageId}/superlike`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
          10000
        )

        const payload = await response.json()

        if (!response.ok) {
          if (payload?.code === "DAILY_LIMIT_REACHED") {
            const resetAt = payload?.resetAt ? new Date(payload.resetAt) : getNextUtcMidnight()
            setState((prev) => ({
              ...prev,
              dailySuperlikeUsed: true,
              dailySuperlikeResetAt: resetAt,
            }))
          }

          if (payload?.code === "DUPLICATE_SUPERLIKE") {
            setState((prev) => {
              const superlikes = new Set(prev.superlikes)
              superlikes.add(imageId)
              return {
                ...prev,
                superlikes,
              }
            })
          }

          return {
            success: false,
            error: payload?.error ?? "No se pudo registrar el superlike",
          }
        }

        const resetAt = payload?.resetAt ? new Date(payload.resetAt) : getNextUtcMidnight()

        setState((prev) => {
          const superlikes = new Set(prev.superlikes)
          superlikes.add(imageId)

          return {
            ...prev,
            superlikes,
            dailySuperlikeUsed: true,
            dailySuperlikeImageId: imageId,
            dailySuperlikeResetAt: resetAt,
          }
        })

        if (typeof payload.superlikeCount === "number") {
          const base = superlikeBaseRef.current.get(imageId) ?? payload.superlikeCount
          superlikeBaseRef.current.set(imageId, base)
          superlikeDeltaRef.current.set(imageId, payload.superlikeCount - base)
          bumpCountVersion()
        }

        return { success: true }
      } catch {
        return { success: false, error: "Error de red al registrar superlike" }
      }
    },
    [bumpCountVersion, state.superlikes]
  )

  const getSuperlikeCount = useCallback(
    (imageId: string) => {
      void countVersion
      return superlikeDeltaRef.current.get(imageId) ?? 0
    },
    [countVersion]
  )

  const superlikeResetTime = useCallback(() => {
    if (!state.dailySuperlikeResetAt) {
      return null
    }

    const diff = state.dailySuperlikeResetAt.getTime() - Date.now()
    if (diff <= 0) {
      return null
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }, [state.dailySuperlikeResetAt])

  const value = useMemo<InteractionsContextType>(() => {
    return {
      registerImages,
      isLiked,
      toggleLike,
      getLikeCount,
      isSuperliked,
      canSuperlike,
      addSuperlike,
      getSuperlikeCount,
      superlikeResetTime,
    }
  }, [
    addSuperlike,
    canSuperlike,
    getLikeCount,
    getSuperlikeCount,
    isLiked,
    isSuperliked,
    registerImages,
    superlikeResetTime,
    toggleLike,
  ])

  return <InteractionsContext.Provider value={value}>{children}</InteractionsContext.Provider>
}

export function useInteractions() {
  const context = useContext(InteractionsContext)
  if (context === undefined) {
    throw new Error("useInteractions must be used within an InteractionsProvider")
  }
  return context
}

