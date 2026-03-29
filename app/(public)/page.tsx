"use client"

import { useEffect, useState } from "react"
import { BrochureCard } from "@/components/brochure-card"
import { getPublishedBrochures } from "@/lib/brochure-store"
import { getMediaUrl } from "@/lib/media-store"
import type { Brochure } from "@/lib/types"

export default function GalleryPage() {
  const [brochures, setBrochures] = useState<Brochure[]>([])
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Brochure | null>(null)

  useEffect(() => {
    let urls: string[] = []

    async function load() {
      try {
        const published = await getPublishedBrochures()
        setBrochures(published)

        const urlMap: Record<string, string> = {}
        await Promise.all(
          published.map(async (b) => {
            if (b.coverThumbnailMediaId) {
              const url = await getMediaUrl(b.coverThumbnailMediaId)
              if (url) {
                urlMap[b.id] = url
                urls.push(url)
              }
            }
          })
        )
        setCoverUrls(urlMap)
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      // Revoke all object URLs on unmount to avoid memory leaks
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  function handleCardClick(brochure: Brochure) {
    // Password modal will be added in Task 7
    setSelected(brochure)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          <span className="text-sm">Loading brochures…</span>
        </div>
      </div>
    )
  }

  if (brochures.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="text-center">
          <p className="text-zinc-400 text-sm">No brochures available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {brochures.map((b) => (
          <BrochureCard
            key={b.id}
            variant="public"
            title={b.title}
            coverUrl={coverUrls[b.id] ?? null}
            onClick={() => handleCardClick(b)}
          />
        ))}
      </div>

      {/* Selected state — used by Task 7 password modal */}
      {selected && null}
    </div>
  )
}
