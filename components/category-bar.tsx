"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { categories } from "@/lib/image-data"

interface CategoryBarProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
}

function TickerSet({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string
  onCategoryChange: (category: string) => void
}) {
  return (
    <>
      {categories.map((category, i) => (
        <button
          key={`${category}-${i}`}
          onClick={() => onCategoryChange(category)}
          className={`shrink-0 py-2.5 px-3 md:px-4 font-display font-extrabold text-[13px] md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
            activeCategory === category
              ? "text-primary-foreground"
              : "text-primary-foreground/50 hover:text-primary-foreground/80"
          }`}
        >
          {category}
          <span className="ml-3 md:ml-4 text-primary-foreground/25 font-sans select-none">/</span>
        </button>
      ))}
    </>
  )
}

export function CategoryBar({ activeCategory, onCategoryChange }: CategoryBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const rafRef = useRef<number>(0)
  const offsetRef = useRef(0)
  const speed = 0.5 // px per frame

  const tick = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    if (!paused) {
      offsetRef.current -= speed
      const halfWidth = track.scrollWidth / 2
      if (Math.abs(offsetRef.current) >= halfWidth) {
        offsetRef.current += halfWidth
      }
      track.style.transform = `translateX(${offsetRef.current}px)`
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [paused])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="bg-primary">
        <div ref={trackRef} className="flex items-center will-change-transform w-max">
          <TickerSet activeCategory={activeCategory} onCategoryChange={onCategoryChange} />
          <TickerSet activeCategory={activeCategory} onCategoryChange={onCategoryChange} />
          <TickerSet activeCategory={activeCategory} onCategoryChange={onCategoryChange} />
        </div>
      </div>
    </div>
  )
}
