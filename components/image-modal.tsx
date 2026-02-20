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

            {/* Action buttons row */}
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

            {/* Superlike - dedicated prominent section */}
            <div className={`mt-4 rounded-xl border overflow-hidden ${
              superliked
                ? "bg-amber-500/8 border-amber-500/20"
                : canSuperlike()
                  ? "bg-surface border-amber-500/15 hover:border-amber-500/30"
                  : "bg-surface/50 border-border/20"
            }`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      superliked ? "bg-amber-500/20" : canSuperlike() ? "bg-amber-500/10" : "bg-surface"
                    }`}>
                      <Star className={`w-4 h-4 ${superliked ? "fill-amber-400 text-amber-400" : canSuperlike() ? "text-amber-400" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${
                        superliked ? "text-amber-400" : canSuperlike() ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        Superlike
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {superliked ? "Le diste tu voto de poder" : canSuperlike() ? "1 por dia. Hazlo contar." : resetTime ? `Se renueva en ${resetTime}` : "Usado hoy"}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-amber-400">{superlikeCount}</span>
                </div>

                <button
                  onClick={handleSuperlike}
                  disabled={superliked || !canSuperlike()}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] ${
                    superliked
                      ? "bg-amber-500/15 text-amber-400 cursor-default"
                      : canSuperlike()
                        ? "bg-amber-500/90 text-black hover:bg-amber-500 hover:shadow-[0_0_24px_rgba(245,158,11,0.3)]"
                        : "bg-surface-hover text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {superliked ? "Superlike dado" : canSuperlike() ? "Dar Superlike" : "Superlike no disponible"}
                </button>
              </div>

              {superlikeError && (
                <div className="px-4 pb-3">
                  <p className="text-[11px] text-amber-400 font-bold">{superlikeError}</p>
                </div>
              )}

              <div className="px-4 py-2.5 bg-amber-500/5 border-t border-amber-500/10">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Las imagenes con mas superlikes entran al <span className="text-amber-400 font-bold">Hall of Fame</span> y se vuelven legendarias para siempre.
                </p>
              </div>
            </div>
          </div>

          <div className="mx-5 lg:mx-6 border-t border-border/20" />

          {/* Survival status card */}
          <div className="p-5 lg:p-6 pb-4">
            <div className={`rounded-xl border overflow-hidden ${
              image.isHallOfFame
                ? "border-amber-500/25"
                : image.isSurvivor
                  ? "border-primary/25"
                  : isDying
                    ? "border-red-500/25 animate-dying"
                    : "border-border/30"
            }`}>
              {/* Status header bar */}
              <div className={`px-4 py-3 flex items-center gap-2.5 ${
                image.isHallOfFame
                  ? "bg-amber-500/10"
                  : image.isSurvivor
                    ? "bg-primary/8"
                    : isDying
                      ? "bg-red-500/10"
                      : "bg-surface"
              }`}>
                {image.isHallOfFame ? (
                  <>
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 font-display uppercase tracking-wider">Hall of Fame</span>
                  </>
                ) : image.isSurvivor ? (
                  <>
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-primary font-display uppercase tracking-wider">Inmortal</span>
                  </>
                ) : isDying ? (
                  <>
                    <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                    <span className="text-xs font-bold text-red-400 font-display uppercase tracking-wider">En peligro</span>
                    <span className="ml-auto text-xs font-mono font-bold text-red-400">{image.hoursLeft}h</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-foreground/60" />
                    <span className="text-xs font-bold text-foreground font-display uppercase tracking-wider">Luchando</span>
                    <span className="ml-auto text-xs font-mono font-bold text-foreground/60">{image.hoursLeft}h</span>
                  </>
                )}
              </div>

              {/* Status body */}
              <div className={`px-4 py-3 ${
                image.isHallOfFame ? "bg-amber-500/5" : image.isSurvivor ? "bg-primary/3" : isDying ? "bg-red-500/5" : "bg-surface/50"
              }`}>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {image.isHallOfFame
                    ? `Legendaria. ${superlikeCount} superlikes la consagraron.`
                    : image.isSurvivor
                      ? "Supero las 24h. Vive para siempre en SCROLLEVER."
                      : `Necesita ${image.likesNeeded.toLocaleString()} likes en 24h para sobrevivir.`
                  }
                </p>

                {/* Progress bar for non-survivors */}
                {!image.isSurvivor && !image.isHallOfFame && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-foreground/50">
                        {likeCount.toLocaleString()} / {image.likesNeeded.toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${
                        isSafe ? "text-primary" : isDying ? "text-red-400" : "text-foreground/50"
                      }`}>
                        {Math.round(survivalProgress)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isSafe ? "bg-primary" : isDying ? "bg-red-500" : "bg-foreground/30"
                        }`}
                        style={{ width: `${survivalProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
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

