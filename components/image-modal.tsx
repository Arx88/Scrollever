"use client"

import { useState, useEffect } from "react"
import {
  X,
  Heart,
  Bookmark,
  Copy,
  Share2,
  Sparkles,
  Cpu,
  User,
  Wand2,
  Check,
  Download,
  Clock,
  Shield,
  Flame,
  Star,
  Crown,
} from "lucide-react"
import type { AIImage } from "@/lib/image-data"
import { useAuth } from "@/lib/auth-context"
import { useInteractions } from "@/lib/interactions-context"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface ImageModalProps {
  image: AIImage | null
  onClose: () => void
}

export function ImageModal({ image, onClose }: ImageModalProps) {
  const { user } = useAuth()
  const { isLiked, toggleLike, getLikeCount, isSuperliked, canSuperlike, addSuperlike, getSuperlikeCount, superlikeResetTime } = useInteractions()
  const router = useRouter()

  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [animateLike, setAnimateLike] = useState(false)
  const [animateSuperlike, setAnimateSuperlike] = useState(false)
  const [superlikeError, setSuperlikeError] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (image) {
      setSaved(false)
      setImageFailed(false)
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [image])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  if (!image) return null

  const liked = isLiked(image.id)
  const superliked = isSuperliked(image.id)
  const likeCount = image.likes + getLikeCount(image.id)
  const superlikeCount = image.superlikes + getSuperlikeCount(image.id)

  const handleLike = async () => {
    if (!user) {
      router.push("/auth/login")
      onClose()
      return
    }

    const nowLiked = await toggleLike(image.id)
    if (nowLiked) {
      setAnimateLike(true)
      setTimeout(() => setAnimateLike(false), 300)
    }
  }

  const handleSuperlike = async () => {
    if (!user) {
      router.push("/auth/login")
      onClose()
      return
    }

    setSuperlikeError(null)
    const result = await addSuperlike(image.id)
    if (result.success) {
      setAnimateSuperlike(true)
      setTimeout(() => setAnimateSuperlike(false), 600)
    } else if (result.error) {
      setSuperlikeError(result.error)
      setTimeout(() => setSuperlikeError(null), 3000)
    }
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const survivalProgress = Math.min((likeCount / image.likesNeeded) * 100, 100)
  const isSafe = image.isSurvivor || survivalProgress >= 100
  const isDying = !image.isSurvivor && image.hoursLeft > 0 && image.hoursLeft <= 6
  const resetTime = superlikeResetTime()

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/98 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Cerrar modal"
      />

      {/* Split screen */}
      <div className={`relative z-10 w-full h-full flex flex-col lg:flex-row transition-all duration-500 ease-out ${visible ? "opacity-100" : "opacity-0 translate-y-4"}`}>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 hover:text-primary transition-all backdrop-blur-md"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT: Image */}
        <div className="relative lg:flex-1 bg-black flex items-center justify-center min-h-[35vh] lg:min-h-0">
          <div className="relative w-full h-[35vh] lg:h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-surface via-background to-surface-hover" />
            <Image
              src={image.src}
              alt={image.prompt.substring(0, 60)}
              fill
              className="object-cover lg:object-contain"
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
              onError={() => setImageFailed(true)}
            />
            {imageFailed && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <p className="text-center text-sm uppercase tracking-widest font-bold text-foreground/60 font-display">
                  Imagen no disponible
                </p>
              </div>
            )}
          </div>

          {/* Superlike burst */}
          {animateSuperlike && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <Star className="w-24 h-24 text-amber-400 fill-amber-400 animate-like" />
            </div>
          )}

          {/* Survival overlay on image */}
          {!image.isSurvivor && image.hoursLeft > 0 && (
            <div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-6 lg:right-6">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-xl ${
                isDying ? "bg-red-500/20 border border-red-500/30" : "bg-black/60 border border-foreground/10"
              }`}>
                <Clock className={`w-3.5 h-3.5 shrink-0 ${isDying ? "text-red-400 animate-pulse" : "text-foreground/60"}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold font-mono uppercase ${isDying ? "text-red-400" : "text-foreground/60"}`}>
                      {isDying ? "Muriendo" : "Luchando"} -- {image.hoursLeft}h restantes
                    </span>
                    <span className="text-[10px] font-mono text-foreground/40">
                      {likeCount.toLocaleString()} / {image.likesNeeded.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isSafe ? "bg-primary" : isDying ? "bg-red-500" : "bg-foreground/30"
                      }`}
                      style={{ width: `${survivalProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Badge on image */}
          {(image.isHallOfFame || image.isSurvivor) && (
            <div className="absolute top-4 left-4 lg:top-6 lg:left-6">
              {image.isHallOfFame ? (
                <div className="flex items-center gap-1.5 bg-amber-500/90 text-black px-3 py-1.5 rounded-lg">
                  <Crown className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider font-display">Hall of Fame</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider font-display">Inmortal</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Info panel */}
        <div className="lg:w-[420px] xl:w-[460px] flex flex-col bg-card overflow-y-auto">

          {/* Author + follow */}
          <div className="p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center ring-1 ring-border">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">@{image.author}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">AI Creator</p>
                </div>
              </div>
              <button className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:shadow-[0_0_20px_rgba(209,254,23,0.2)] transition-all active:scale-95">
                Seguir
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {/* Like */}
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 flex-1 justify-center ${
                  liked
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-surface text-foreground hover:bg-surface-hover"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${liked ? "fill-primary text-primary" : ""} ${animateLike ? "animate-like" : ""}`}
                />
                {likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
              </button>

              {/* Superlike */}
              <button
                onClick={handleSuperlike}
                disabled={superliked}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 flex-1 justify-center ${
                  superliked
                    ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                    : canSuperlike()
                      ? "bg-surface text-foreground hover:bg-amber-500/10 hover:text-amber-400"
                      : "bg-surface text-muted-foreground opacity-50 cursor-not-allowed"
                }`}
              >
                <Star
                  className={`w-4 h-4 ${superliked ? "fill-amber-400 text-amber-400" : ""}`}
                />
                {superlikeCount}
              </button>

              {/* Save */}
              <button
                onClick={() => setSaved(!saved)}
                className={`p-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  saved
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-surface text-foreground hover:bg-surface-hover"
                }`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
              </button>
              <button className="p-2.5 rounded-lg bg-surface text-foreground hover:bg-surface-hover transition-all active:scale-95" aria-label="Compartir">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="p-2.5 rounded-lg bg-surface text-foreground hover:bg-surface-hover transition-all active:scale-95" aria-label="Descargar">
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Superlike error/info */}
            {superlikeError && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] text-amber-400 font-bold">{superlikeError}</p>
              </div>
            )}

            {/* Superlike daily status */}
            {user && !canSuperlike() && !superliked && resetTime && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-surface border border-border/20">
                <p className="text-[10px] text-muted-foreground">
                  Superlike usado hoy. Se renueva en <span className="text-foreground font-bold">{resetTime}</span>
                </p>
              </div>
            )}

            {/* Superlike context message */}
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] uppercase tracking-[0.15em] text-amber-400 font-bold">Superlike</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                1 por dia. Significa {"\"esta merece ser historica\""}. Las imagenes con mas superlikes entran al Hall of Fame.
              </p>
            </div>
          </div>

          <div className="mx-5 lg:mx-6 border-t border-border/20" />

          {/* Survival status card */}
          <div className="p-5 lg:p-6 pb-4">
            <div className={`p-3.5 rounded-xl border ${
              image.isHallOfFame
                ? "bg-amber-500/5 border-amber-500/20"
                : image.isSurvivor
                  ? "bg-primary/5 border-primary/20"
                  : isDying
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-surface border-border/30"
            }`}>
              <div className="flex items-center gap-2.5 mb-2">
                {image.isHallOfFame ? (
                  <>
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 font-display uppercase">Hall of Fame</span>
                  </>
                ) : image.isSurvivor ? (
                  <>
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-primary font-display uppercase">Sobreviviente Inmortal</span>
                  </>
                ) : isDying ? (
                  <>
                    <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                    <span className="text-xs font-bold text-red-400 font-display uppercase">En peligro de extincion</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground font-display uppercase">Luchando por sobrevivir</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {image.isHallOfFame
                  ? `Esta imagen es legendaria. ${superlikeCount} superlikes la consagraron en el Hall of Fame de SCROLLEVER.`
                  : image.isSurvivor
                    ? "Esta imagen supero las 24h con suficientes likes. Ahora vive para siempre en SCROLLEVER."
                    : `Necesita ${image.likesNeeded.toLocaleString()} likes en 24h para sobrevivir. Le quedan ${image.hoursLeft}h. Tu like puede salvarla.`
                }
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 lg:px-6 pb-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
              Stats
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface rounded-lg p-2.5 border border-border/20 text-center">
                <p className="text-lg font-bold text-foreground font-mono">
                  {likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Likes</p>
              </div>
              <div className="bg-surface rounded-lg p-2.5 border border-border/20 text-center">
                <p className="text-lg font-bold text-amber-400 font-mono">{superlikeCount}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Superlikes</p>
              </div>
              <div className="bg-surface rounded-lg p-2.5 border border-border/20 text-center">
                <p className="text-lg font-bold text-foreground font-mono">
                  {image.isSurvivor ? "--" : `${image.hoursLeft}h`}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {image.isSurvivor ? "Inmortal" : "Restantes"}
                </p>
              </div>
            </div>
          </div>

          {/* Model */}
          <div className="px-5 lg:px-6 pb-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-primary" />
              Modelo
            </h3>
            <div className="flex items-center gap-2.5 p-3 bg-surface rounded-xl border border-border/20">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{image.model}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{image.createdAt}</p>
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="px-5 lg:px-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                Prompt
              </h3>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-bold active:scale-95"
              >
                {copied ? (
                  <><Check className="w-3 h-3" /> Copiado</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar</>
                )}
              </button>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-border/20">
              <p className="text-[13px] text-foreground/80 leading-relaxed">
                {image.prompt}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="px-5 lg:px-6 pb-4">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                {image.category}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-surface text-muted-foreground px-2.5 py-1 rounded-md border border-border/20">
                {image.model.split(" ")[0]}
              </span>
              {image.isSurvivor && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                  Inmortal
                </span>
              )}
              {image.isHallOfFame && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-md">
                  Hall of Fame
                </span>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* CTA */}
          <div className="p-5 lg:p-6 border-t border-border/10">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:shadow-[0_0_24px_rgba(209,254,23,0.25)] transition-all active:scale-[0.98]">
              <Wand2 className="w-4 h-4" />
              Generar variante
            </button>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Crea una nueva imagen con este prompt como base
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

