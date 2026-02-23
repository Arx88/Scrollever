"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { CategoryBar } from "@/components/category-bar"
import { MasonryGrid } from "@/components/masonry-grid"
import { ImageModal } from "@/components/image-modal"
import type { AIImage } from "@/lib/image-data"
import type { FeedViewMode } from "@/lib/feed-view"

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("En llamas")
  const [activeFeedView, setActiveFeedView] = useState<FeedViewMode>("mixed-position")
  const [selectedImage, setSelectedImage] = useState<AIImage | null>(null)

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <MasonryGrid
        activeCategory={activeCategory}
        activeFeedView={activeFeedView}
        onImageClick={(image) => setSelectedImage(image)}
      />
      <CategoryBar
        activeCategory={activeCategory}
        activeFeedView={activeFeedView}
        onCategoryChange={setActiveCategory}
        onFeedViewChange={setActiveFeedView}
      />
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </main>
  )
}
