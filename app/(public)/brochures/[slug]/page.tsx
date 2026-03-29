"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import BookReader, { type BookReaderHandle } from "@/components/book-reader"
import { PasswordModal } from "@/components/password-modal"
import NavigationOverlay from "@/components/navigation-overlay"
import ThumbnailModal from "@/components/thumbnail-modal"
import { getBrochureBySlug } from "@/lib/brochure-store"
import { getMediaUrl } from "@/lib/media-store"
import type { Brochure, ImageContent } from "@/lib/types"

export default function BrochureReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()

  const [brochure, setBrochure] = useState<Brochure | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [mediaReady, setMediaReady] = useState(false)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false)

  const bookRef = useRef<BookReaderHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /* ---------- load brochure ---------- */

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!slug) return
      const b = await getBrochureBySlug(slug)
      if (cancelled) return

      if (!b) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setBrochure(b)

      // Check session unlock
      const isUnlocked = sessionStorage.getItem("unlocked:" + b.id) === "true"
      if (isUnlocked) {
        setUnlocked(true)
      } else {
        setShowPasswordModal(true)
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  /* ---------- resolve all media URLs ---------- */

  useEffect(() => {
    if (!brochure || !unlocked) return

    let cancelled = false
    const urls: Record<string, string> = {}

    async function resolveMedia() {
      // Collect all unique media ids
      const ids = new Set<string>()

      for (const spread of brochure!.spreads) {
        if (spread.leftBackgroundMediaId) ids.add(spread.leftBackgroundMediaId)
        if (spread.rightBackgroundMediaId) ids.add(spread.rightBackgroundMediaId)
        if (spread.fullSpreadBackgroundMediaId) ids.add(spread.fullSpreadBackgroundMediaId)

        for (const el of spread.elements) {
          if (el.type === "image") {
            const content = el.content as ImageContent
            if (content.mediaId) ids.add(content.mediaId)
          }
        }
      }

      // Resolve each id to an object URL
      await Promise.all(
        Array.from(ids).map(async (id) => {
          const url = await getMediaUrl(id)
          if (url) urls[id] = url
        }),
      )

      if (cancelled) {
        // Revoke if we got cancelled before setting state
        Object.values(urls).forEach((u) => URL.revokeObjectURL(u))
        return
      }

      setMediaUrls(urls)
      setMediaReady(true)
    }

    resolveMedia()

    return () => {
      cancelled = true
      // Revoke all object URLs on unmount
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [brochure, unlocked])

  /* ---------- deep-link page calculation ---------- */

  const initialPage = (() => {
    const pageParam = searchParams.get("page")
    if (!pageParam) return 0
    const pageNum = parseInt(pageParam, 10)
    if (isNaN(pageNum) || pageNum <= 0) return 0
    const spreadIdx = Math.ceil(pageNum / 2)
    return spreadIdx * 2
  })()

  /* ---------- password unlock handler ---------- */

  const handleUnlocked = useCallback(() => {
    setUnlocked(true)
    setShowPasswordModal(false)
  }, [])

  /* ---------- page change handler ---------- */

  const handlePageChange = useCallback((pageIndex: number) => {
    setCurrentPageIndex(pageIndex)
  }, [])

  /* ---------- navigation callbacks ---------- */

  const totalPages = brochure ? brochure.spreads.length * 2 : 0
  const currentSpreadIndex = Math.floor(currentPageIndex / 2)

  const handlePrev = useCallback(() => {
    bookRef.current?.flipPrev()
  }, [])

  const handleNext = useCallback(() => {
    bookRef.current?.flipNext()
  }, [])

  const handleCover = useCallback(() => {
    bookRef.current?.flipToPage(0)
  }, [])

  const handleViewAll = useCallback(() => {
    setThumbnailModalOpen(true)
  }, [])

  const handleSelectSpread = useCallback((spreadIndex: number) => {
    bookRef.current?.flipToPage(spreadIndex * 2)
    setThumbnailModalOpen(false)
  }, [])

  /* ---------- keyboard listeners ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          if (currentPageIndex > 1) {
            bookRef.current?.flipPrev()
          }
          break
        case "ArrowRight":
          bookRef.current?.flipNext()
          break
        case "Home":
          bookRef.current?.flipToPage(0)
          break
        case "Escape":
          setThumbnailModalOpen(false)
          break
      }
    }

    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [currentPageIndex])

  /* ---------- auto-focus reader container on mount ---------- */

  useEffect(() => {
    if (unlocked && mediaReady) {
      containerRef.current?.focus()
    }
  }, [unlocked, mediaReady])

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="bg-zinc-950 min-h-screen flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="bg-zinc-950 min-h-screen flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Brochure not found</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-950 min-h-screen flex items-center justify-center">
      {/* Password gate */}
      <PasswordModal
        brochure={brochure}
        open={showPasswordModal}
        onOpenChange={setShowPasswordModal}
        onUnlocked={handleUnlocked}
      />

      {/* Book reader with navigation overlay */}
      {unlocked && mediaReady && brochure && (
        <>
          <div
            ref={containerRef}
            tabIndex={0}
            className="relative w-full h-screen outline-none"
          >
            <BookReader
              ref={bookRef}
              brochure={brochure}
              initialPage={initialPage}
              mediaUrls={mediaUrls}
              onPageChange={handlePageChange}
            />
            <NavigationOverlay
              currentPageIndex={currentPageIndex}
              totalPages={totalPages}
              onPrev={handlePrev}
              onNext={handleNext}
              onCover={handleCover}
              onViewAll={handleViewAll}
            />
          </div>

          <ThumbnailModal
            spreads={brochure.spreads}
            currentSpreadIndex={currentSpreadIndex}
            mediaUrls={mediaUrls}
            open={thumbnailModalOpen}
            onOpenChange={setThumbnailModalOpen}
            onSelectSpread={handleSelectSpread}
          />
        </>
      )}
    </div>
  )
}
