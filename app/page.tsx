"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { CategoryBar } from "@/components/category-bar"
import { MasonryGrid } from "@/components/masonry-grid"
import { ImageModal } from "@/components/image-modal"
import type { AIImage } from "@/lib/image-data"

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("En llamas")
  const [selectedImage, setSelectedImage] = useState<AIImage | null>(null)

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <MasonryGrid
        activeCategory={activeCategory}
        onImageClick={(image) => setSelectedImage(image)}
      />
      <CategoryBar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </main>
  )
}
