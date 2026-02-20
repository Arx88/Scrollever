"use client"

import { categories } from "@/lib/image-data"

interface CategoryBarProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export function CategoryBar({ activeCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-primary">
        <div className="flex items-center overflow-x-auto scrollbar-hide">
          {categories.map((category, i) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`shrink-0 py-2.5 px-2.5 md:px-4 font-display font-extrabold text-[13px] md:text-sm uppercase tracking-wide transition-all whitespace-nowrap ${
                activeCategory === category
                  ? "text-primary-foreground"
                  : "text-primary-foreground/50 hover:text-primary-foreground/80"
              }`}
            >
              {category}
              {i < categories.length - 1 && (
                <span className="ml-2.5 md:ml-4 text-primary-foreground/25 font-sans select-none">{'/'}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
