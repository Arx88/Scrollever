export type FeedViewMode = "mixed-position" | "mixed-newest" | "immortals"

export interface FeedViewOption {
  key: FeedViewMode
  label: string
}

export const FEED_VIEW_OPTIONS: FeedViewOption[] = [
  { key: "mixed-position", label: "Feed Posicion" },
  { key: "mixed-newest", label: "Novedad" },
  { key: "immortals", label: "Inmortales" },
]
