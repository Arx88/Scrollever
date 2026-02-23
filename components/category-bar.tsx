"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { categories } from "@/lib/image-data"
import { FEED_VIEW_OPTIONS, type FeedViewMode } from "@/lib/feed-view"

interface CategoryBarProps {
  activeCategory: string
  activeFeedView: FeedViewMode
  onCategoryChange: (category: string) => void
  onFeedViewChange: (mode: FeedViewMode) => void
}

function TickerSet({
  activeCategory,
  activeFeedView,
  onCategoryChange,
  onFeedViewChange,
}: {
  activeCategory: string
  activeFeedView: FeedViewMode
  onCategoryChange: (category: string) => void
  onFeedViewChange: (mode: FeedViewMode) => void
}) {
  return (
    <>
      {FEED_VIEW_OPTIONS.map((option, i) => (
        <button
          key={`feed-${option.key}-${i}`}
          onClick={() => onFeedViewChange(option.key)}
          className={`shrink-0 py-2.5 px-3 md:px-4 font-display font-extrabold text-[13px] md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
            activeFeedView === option.key
              ? "text-primary-foreground"
              : "text-primary-foreground/55 hover:text-primary-foreground/80"
          }`}
        >
          {option.label}
          <span className="ml-3 md:ml-4 text-primary-foreground/25 font-sans select-none">/</span>
        </button>
      ))}

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

export function CategoryBar({
  activeCategory,
  activeFeedView,
  onCategoryChange,
  onFeedViewChange,
}: CategoryBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const rafRef = useRef<number>(0)
  const offsetRef = useRef(0)
  const speed = 0.5

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
          <TickerSet
            activeCategory={activeCategory}
            activeFeedView={activeFeedView}
            onCategoryChange={onCategoryChange}
            onFeedViewChange={onFeedViewChange}
          />
          <TickerSet
            activeCategory={activeCategory}
            activeFeedView={activeFeedView}
            onCategoryChange={onCategoryChange}
            onFeedViewChange={onFeedViewChange}
          />
          <TickerSet
            activeCategory={activeCategory}
            activeFeedView={activeFeedView}
            onCategoryChange={onCategoryChange}
            onFeedViewChange={onFeedViewChange}
          />
        </div>
      </div>
    </div>
  )
}
