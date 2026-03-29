"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  Type,
  Image,
  Palette,
} from "lucide-react"
import { isAuthenticated } from "@/lib/auth"
import { getBrochureById } from "@/lib/brochure-store"
import { getMediaUrl } from "@/lib/media-store"
import type { Brochure, BrochureElement, ImageContent } from "@/lib/types"
import EditorCanvas from "@/components/editor/editor-canvas"

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [brochure, setBrochure] = useState<Brochure | null>(null)
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in")
    }
  }, [router])

  // Load brochure
  useEffect(() => {
    if (!id) return
    getBrochureById(id).then((b) => {
      if (b) {
        setBrochure(b)
      } else {
        router.replace("/dashboard")
      }
    })
  }, [id, router])

  // Resolve all media IDs to object URLs
  useEffect(() => {
    if (!brochure) return

    const mediaIds = new Set<string>()
    for (const spread of brochure.spreads) {
      if (spread.fullSpreadBackgroundMediaId) mediaIds.add(spread.fullSpreadBackgroundMediaId)
      if (spread.leftBackgroundMediaId) mediaIds.add(spread.leftBackgroundMediaId)
      if (spread.rightBackgroundMediaId) mediaIds.add(spread.rightBackgroundMediaId)
      for (const el of spread.elements) {
        if (el.type === "image") {
          const content = el.content as ImageContent
          if (content.mediaId) mediaIds.add(content.mediaId)
        }
      }
    }

    let revoked = false
    const urls: Record<string, string> = {}

    async function resolveAll() {
      const entries = Array.from(mediaIds)
      const results = await Promise.all(
        entries.map(async (mid) => {
          const url = await getMediaUrl(mid)
          return [mid, url] as const
        })
      )
      if (revoked) return
      for (const [mid, url] of results) {
        if (url) urls[mid] = url
      }
      setMediaUrls(urls)
    }

    resolveAll()

    return () => {
      revoked = true
      for (const url of Object.values(urls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [brochure])

  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<BrochureElement>) => {
      setBrochure((prev) => {
        if (!prev) return prev
        const newSpreads = prev.spreads.map((spread, idx) => {
          if (idx !== currentSpreadIndex) return spread
          return {
            ...spread,
            elements: spread.elements.map((el) =>
              el.id === elementId ? { ...el, ...updates } : el
            ),
          }
        })
        return { ...prev, spreads: newSpreads }
      })
    },
    [currentSpreadIndex]
  )

  const handleSelectElement = useCallback((elId: string | null) => {
    setSelectedElementId(elId)
  }, [])

  const handleTitleChange = useCallback((newTitle: string) => {
    setBrochure((prev) => (prev ? { ...prev, title: newTitle } : prev))
  }, [])

  if (!brochure) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading editor...</p>
      </div>
    )
  }

  const currentSpread = brochure.spreads[currentSpreadIndex]
  const totalSpreads = brochure.spreads.length

  // Spread label: first spread is "Cover", rest are "Pages N-M"
  let spreadLabel: string
  if (currentSpreadIndex === 0) {
    spreadLabel = "Cover"
  } else {
    const leftPage = currentSpreadIndex * 2
    const rightPage = leftPage + 1
    spreadLabel = `Pages ${leftPage}-${rightPage}`
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center gap-4 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        <div className="w-px h-6 bg-zinc-800" />

        <input
          type="text"
          value={brochure.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="bg-transparent border-none outline-none text-zinc-100 text-sm font-medium px-2 py-1 rounded hover:bg-zinc-800 focus:bg-zinc-800 transition-colors min-w-0 flex-shrink"
        />

        <div className="flex-1" />

        {/* Spread navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSpreadIndex((i) => Math.max(0, i - 1))}
            disabled={currentSpreadIndex === 0}
            className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-400 min-w-[80px] text-center">
            {spreadLabel}
          </span>
          <button
            onClick={() => setCurrentSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1))}
            disabled={currentSpreadIndex === totalSpreads - 1}
            className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Save button (placeholder, wired in Task 17) */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors">
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-2 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Tools</p>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left">
            <Type className="w-4 h-4" />
            Insert Text
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left">
            <Image className="w-4 h-4" />
            Insert Image
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left">
            <Palette className="w-4 h-4" />
            Backgrounds
          </button>
        </div>

        {/* Center canvas */}
        {currentSpread && (
          <EditorCanvas
            spread={currentSpread}
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            mediaUrls={mediaUrls}
          />
        )}

        {/* Right sidebar */}
        <div className="w-56 border-l border-zinc-800 p-4 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Layers</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-24 border-t border-zinc-800 px-4 flex items-center shrink-0">
        <p className="text-xs text-zinc-500">Spreads</p>
      </div>
    </div>
  )
}
