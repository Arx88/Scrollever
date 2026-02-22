"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { LoginPopupConfig } from "@/lib/admin/popup-config"

interface LoginPopupCardProps {
  config: LoginPopupConfig
  onConfirm?: () => void
  className?: string
  confirmDisabled?: boolean
}

export function LoginPopupCard({
  config,
  onConfirm,
  className,
  confirmDisabled = false,
}: LoginPopupCardProps) {
  const layout = config.layout
  const widthPercent = layout.widthPercent ?? layout.sizePercent ?? 100
  const heightPercent = layout.heightPercent ?? layout.sizePercent ?? 100
  const titleScale = (layout.titleSizePercent ?? 100) / 100
  const messageScale = (layout.messageSizePercent ?? 100) / 100
  const buttonScale = (layout.buttonSizePercent ?? 100) / 100
  const popupWidth = Math.round(1130 * (widthPercent / 100))
  const popupHeight = Math.round(700 * (heightPercent / 100))
  const popupRadius = Math.round(layout.radiusPx)
  const popupClipPath = `inset(0 round ${popupRadius}px)`

  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const [titleFontSize, setTitleFontSize] = useState(64)

  const fitTitleToSingleLine = useCallback(() => {
    const titleElement = titleRef.current
    const containerElement = titleContainerRef.current
    if (!titleElement || !containerElement) {
      return
    }

    const maxFontSize =
      window.innerWidth >= 1536 ? 86 : window.innerWidth >= 1280 ? 78 : window.innerWidth >= 1024 ? 68 : window.innerWidth >= 768 ? 56 : 42
    const minFontSize = 10

    let low = minFontSize
    let high = maxFontSize
    let best = minFontSize

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      titleElement.style.fontSize = `${mid}px`

      if (titleElement.scrollWidth <= containerElement.clientWidth) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    let scaledSize = Math.max(minFontSize, Math.round(best * titleScale))
    titleElement.style.fontSize = `${scaledSize}px`
    while (scaledSize > minFontSize && titleElement.scrollWidth > containerElement.clientWidth) {
      scaledSize -= 1
      titleElement.style.fontSize = `${scaledSize}px`
    }

    setTitleFontSize(scaledSize)
  }, [titleScale])

  useEffect(() => {
    fitTitleToSingleLine()

    const handleResize = () => {
      fitTitleToSingleLine()
    }

    window.addEventListener("resize", handleResize)
    const observer = new ResizeObserver(() => {
      fitTitleToSingleLine()
    })

    if (titleContainerRef.current) {
      observer.observe(titleContainerRef.current)
    }

    return () => {
      window.removeEventListener("resize", handleResize)
      observer.disconnect()
    }
  }, [config.title, fitTitleToSingleLine])

  const buttonWidthPercent = Math.max(55, Math.min(125, Math.round(buttonScale * 100)))

  return (
    <div
      className={cn(
        "relative isolate w-full mx-auto overflow-hidden border border-border/20 bg-black shadow-[0_30px_120px_rgba(0,0,0,0.75)]",
        className
      )}
      style={{
        maxWidth: `${popupWidth}px`,
        aspectRatio: `${popupWidth} / ${popupHeight}`,
        borderRadius: `${popupRadius}px`,
        clipPath: popupClipPath,
      }}
    >
      <div className="absolute inset-0 [border-radius:inherit] overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-full md:w-[56%]">
          <Image
            src={config.imageUrl}
            alt={config.title}
            fill
            sizes="(max-width: 768px) 100vw, 1130px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(209,254,23,0.24),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/25 to-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(209,254,23,0.08),transparent_40%)]" />
      </div>

      <div className="relative grid h-full md:grid-cols-[1fr_1.2fr] [border-radius:inherit] overflow-hidden">
        <div className="hidden md:block" aria-hidden />

        <div className="flex items-center px-6 py-8 md:px-9 md:py-10 lg:px-10 lg:py-12">
          <div
            ref={titleContainerRef}
            className="w-full max-w-[560px]"
            style={{
              transform: `translate(${layout.contentOffsetX}px, ${layout.contentOffsetY}px)`,
            }}
          >
            <h2
              ref={titleRef}
              style={{
                fontSize: `${titleFontSize}px`,
                transform: `translateY(${layout.titleOffsetY}px)`,
              }}
              className="max-w-full font-display font-extrabold text-foreground uppercase tracking-tight leading-[0.95] whitespace-nowrap"
            >
              {config.title}
            </h2>
            <p
              className="mt-5 text-base md:text-xl text-foreground/82 leading-relaxed max-w-[42ch]"
              style={{
                transform: `translateY(${layout.messageOffsetY}px)`,
                fontSize: `clamp(${Math.round(14 * messageScale)}px, ${(1.1 * messageScale).toFixed(3)}vw, ${Math.round(22 * messageScale)}px)`,
              }}
            >
              {config.message}
            </p>

            <div style={{ transform: `translateY(${layout.buttonOffsetY}px)` }}>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="popup-confirm-btn relative mt-7 md:mt-8 w-full overflow-hidden rounded-2xl text-primary-foreground font-display font-extrabold text-xl md:text-2xl uppercase tracking-wider py-4 md:py-5 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  width: `${buttonWidthPercent}%`,
                  marginInline: "auto",
                  fontSize: `clamp(${Math.round(15 * buttonScale)}px, ${(1.25 * buttonScale).toFixed(3)}vw, ${Math.round(32 * buttonScale)}px)`,
                  paddingTop: `${Math.round(16 * buttonScale)}px`,
                  paddingBottom: `${Math.round(16 * buttonScale)}px`,
                }}
              >
                <span aria-hidden className="popup-confirm-btn-shine" />
                <span aria-hidden className="popup-confirm-btn-coat" />
                <span className="relative z-[3]">{config.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
