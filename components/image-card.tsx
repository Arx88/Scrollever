"use client"

import { useState } from "react"
import { Heart, Bookmark, Clock, Shield, Star, Crown } from "lucide-react"
import type { AIImage } from "@/lib/image-data"
import { useAuth } from "@/lib/auth-context"
import { useInteractions } from "@/lib/interactions-context"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface ImageCardProps {
  image: AIImage
  index: number
  onImageClick: (image: AIImage) => void
  isFeatured?: boolean
}

export function ImageCard({ image, index, onImageClick, isFeatured }: ImageCardProps) {
  const { user } = useAuth()
  const { isLiked, toggleLike, getLikeCount, isSuperliked, canSuperlike, addSuperlike, getSuperlikeCount } = useInteractions()
  const router = useRouter()

  const [saved, setSaved] = useState(false)
  const [animateLike, setAnimateLike] = useState(false)
  const [animateSuperlike, setAnimateSuperlike] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [showSuperlikeToast, setShowSuperlikeToast] = useState<string | null>(null)

  const liked = isLiked(image.id)
  const superliked = isSuperliked(image.id)
  const likeCount = image.likes + getLikeCount(image.id)
  const superlikeCount = image.superlikes + getSuperlikeCount(image.id)
  const superlikeEnabled = superliked || canSuperlike()

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      router.push("/auth/login")
      return
    }

    const nowLiked = await toggleLike(image.id)
    if (nowLiked) {
      setAnimateLike(true)
      setTimeout(() => setAnimateLike(false), 300)
    }
  }

  const handleSuperlike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      router.push("/auth/login")
      return
    }

    const result = await addSuperlike(image.id)
    if (result.success) {
      setAnimateSuperlike(true)
      setTimeout(() => setAnimateSuperlike(false), 600)
    } else if (result.error) {
      setShowSuperlikeToast(result.error)
      setTimeout(() => setShowSuperlikeToast(null), 2500)
    }
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaved(!saved)
  }

  const survivalProgress = Math.min((likeCount / image.likesNeeded) * 100, 100)
  const isDying = !image.isSurvivor && image.hoursLeft > 0 && image.hoursLeft <= 6
  const isSafe = image.isSurvivor || survivalProgress >= 100

  const [lastTap, setLastTap] = useState(0)
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const tapTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap < 300) {
      if (tapTimeoutRef[0]) clearTimeout(tapTimeoutRef[0])
      if (!liked && user) {
        void toggleLike(image.id)
      }
      setShowHeartBurst(true)
      setTimeout(() => setShowHeartBurst(false), 600)
      setLastTap(0)
    } else {
      setLastTap(now)
      const timeout = setTimeout(() => {
        onImageClick(image)
      }, 300)
      tapTimeoutRef[0] = timeout
    }
  }

  return (
    <div
      className="group relative w-full h-full overflow-hidden cursor-pointer rounded-lg md:rounded-xl"
      onClick={handleTap}
    >
      {!imageLoaded && <div className="absolute inset-0 animate-shimmer rounded-lg md:rounded-xl" />}
      <div className="absolute inset-0 bg-gradient-to-br from-surface via-background to-surface-hover" />

      <Image
        src={image.src}
        alt={image.prompt.substring(0, 60)}
        fill
        className={`object-cover transition-all duration-700 ease-out group-hover:scale-[1.03] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        sizes={isFeatured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          setImageFailed(true)
          setImageLoaded(true)
        }}
      />

      {imageFailed && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <p className="text-center text-[11px] uppercase tracking-wider font-bold text-foreground/60 font-display">
            Vista previa no disponible
          </p>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Heart className="w-16 h-16 text-primary fill-primary animate-like" />
        </div>
      )}

      {animateSuperlike && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Star className="w-20 h-20 text-amber-400 fill-amber-400 animate-like" />
        </div>
      )}

      {showSuperlikeToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-md text-foreground text-[11px] font-bold px-3 py-2 rounded-lg whitespace-nowrap border border-border/30">
            {showSuperlikeToast}
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
        {image.isHallOfFame ? (
          <div className="flex items-center gap-1 bg-amber-500/90 text-black px-2 py-1 rounded-md">
            <Crown className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Hall of Fame</span>
          </div>
        ) : image.isSurvivor ? (
          <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded-md">
            <Shield className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Inmortal</span>
          </div>
        ) : image.hoursLeft > 0 ? (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md backdrop-blur-md ${
              isDying ? "bg-red-500/80 text-foreground" : "bg-black/60 text-foreground/80"
            }`}
          >
            <Clock className={`w-3 h-3 ${isDying ? "animate-pulse" : ""}`} />
            <span className="text-[9px] font-bold font-mono">{image.hoursLeft}h</span>
          </div>
        ) : null}
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
        <button
          onClick={handleSave}
          className={`p-1.5 rounded-lg backdrop-blur-md transition-all active:scale-90 ${
            saved ? "bg-primary text-primary-foreground" : "bg-black/50 text-foreground hover:bg-black/70"
          }`}
          aria-label={saved ? "Quitar de guardados" : "Guardar"}
        >
          <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
        {!image.isSurvivor && (
          <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px] font-mono text-foreground/60 uppercase tracking-wider">
                {isSafe ? "Sobrevive" : `${likeCount.toLocaleString()} / ${image.likesNeeded.toLocaleString()}`}
              </span>
            </div>
            <div className="h-[2px] w-full bg-foreground/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSafe ? "bg-primary" : isDying ? "bg-red-500" : "bg-foreground/40"
                }`}
                style={{ width: `${survivalProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={(event) => void handleLike(event)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md text-xs font-bold transition-all active:scale-90 ${
                liked ? "bg-primary/20 text-primary" : "bg-black/40 text-foreground/90 hover:bg-black/60"
              }`}
              aria-label={liked ? "Quitar like" : "Dar like"}
            >
              <Heart className={`w-3 h-3 ${liked ? "fill-primary text-primary" : ""} ${animateLike ? "animate-like" : ""}`} />
              <span>{likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}</span>
            </button>

            <button
              onClick={(event) => void handleSuperlike(event)}
              disabled={!superlikeEnabled}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md text-xs font-bold transition-all active:scale-90 ${
                superliked
                  ? "bg-amber-500/20 text-amber-400"
                  : superlikeEnabled
                    ? "bg-black/40 text-foreground/90 hover:bg-black/60"
                    : "bg-black/20 text-foreground/40 cursor-not-allowed"
              }`}
              aria-label={superliked ? "Superlike dado" : "Dar superlike"}
            >
              <Star className={`w-3 h-3 ${superliked ? "fill-amber-400 text-amber-400" : ""}`} />
              <span>{superlikeCount}</span>
            </button>
          </div>

          <span className="text-[8px] font-mono bg-black/40 backdrop-blur-md text-foreground/50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate max-w-[80px]">
            {image.model}
          </span>
        </div>
      </div>
    </div>
  )
}

