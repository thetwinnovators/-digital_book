"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { getMediaUrl, saveMedia, validateImageFile } from "@/lib/media-store"
import { generateId } from "@/lib/utils"
import type { Brochure, BrochureElement, ImageContent, TextContent } from "@/lib/types"
import EditorCanvas from "@/components/editor/editor-canvas"
import Toolbar from "@/components/editor/toolbar"

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

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInsertText = useCallback(() => {
    setBrochure((prev) => {
      if (!prev) return prev
      const spread = prev.spreads[currentSpreadIndex]
      const newElement: BrochureElement = {
        id: generateId(),
        type: "text",
        x: 210,
        y: 300,
        width: 300,
        height: 100,
        rotation: 0,
        zIndex: spread.elements.length,
        locked: false,
        content: {
          html: "",
          fontFamily: "Inter",
          fontSize: 16,
          color: "#ffffff",
          fontWeight: "400",
          alignment: "left",
          lineHeight: 1.5,
          letterSpacing: 0,
          opacity: 1,
        } satisfies TextContent,
      }
      const newSpreads = prev.spreads.map((s, idx) => {
        if (idx !== currentSpreadIndex) return s
        return { ...s, elements: [...s.elements, newElement] }
      })
      setSelectedElementId(newElement.id)
      return { ...prev, spreads: newSpreads }
    })
  }, [currentSpreadIndex])

  const handleInsertImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      // Reset so the same file can be picked again
      e.target.value = ""

      const validation = validateImageFile(file)
      if (!validation.valid) {
        alert(validation.error)
        return
      }

      const mediaId = generateId()
      await saveMedia({
        id: mediaId,
        brochureId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      // Create object URL for immediate display
      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBrochure((prev) => {
        if (!prev) return prev
        const spread = prev.spreads[currentSpreadIndex]
        const newElement: BrochureElement = {
          id: generateId(),
          type: "image",
          x: 210,
          y: 300,
          width: 300,
          height: 200,
          rotation: 0,
          zIndex: spread.elements.length,
          locked: false,
          content: {
            mediaId,
            objectFit: "cover",
          } satisfies ImageContent,
        }
        const newSpreads = prev.spreads.map((s, idx) => {
          if (idx !== currentSpreadIndex) return s
          return { ...s, elements: [...s.elements, newElement] }
        })
        setSelectedElementId(newElement.id)
        return { ...prev, spreads: newSpreads }
      })
    },
    [id, currentSpreadIndex]
  )

  const handleToolbarChange = useCallback(
    (newContent: TextContent) => {
      if (!selectedElementId) return
      handleUpdateElement(selectedElementId, { content: newContent })
    },
    [selectedElementId, handleUpdateElement]
  )

  if (!brochure) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading editor...</p>
      </div>
    )
  }

  const currentSpread = brochure.spreads[currentSpreadIndex]
  const totalSpreads = brochure.spreads.length

  const selectedElement = selectedElementId
    ? currentSpread.elements.find((el) => el.id === selectedElementId) ?? null
    : null

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

      {/* Formatting toolbar — shown when a text element is selected */}
      {selectedElement && selectedElement.type === "text" && (
        <div className="flex justify-center py-1 bg-zinc-950 border-b border-zinc-800 shrink-0">
          <Toolbar
            content={selectedElement.content as TextContent}
            onChange={handleToolbarChange}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-2 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Tools</p>
          <button
            onClick={handleInsertText}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Type className="w-4 h-4" />
            Insert Text
          </button>
          <button
            onClick={handleInsertImage}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Image className="w-4 h-4" />
            Insert Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
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
