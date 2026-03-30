"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import BookReader, { type BookReaderHandle } from "@/components/book-reader"
import { PasswordModal } from "@/components/password-modal"
import NavigationOverlay from "@/components/navigation-overlay"
import ThumbnailModal from "@/components/thumbnail-modal"
import { getBookBySlug } from "@/lib/book-store"
import { getMediaUrl } from "@/lib/media-store"
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from "@/lib/constants"
import type { Book, ImageContent } from "@/lib/types"

function ResolutionWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg px-6 py-4 max-w-sm text-center shadow-none">
        <p className="text-gray-700 text-sm mb-4">
          For optimal viewing, view in a resolution of 1920×1080 or higher.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-1.5 rounded border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function BookReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [book, setBook] = useState<Book | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [mediaReady, setMediaReady] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false)
  const [showResWarning, setShowResWarning] = useState(false)
  const [resWarningDismissed, setResWarningDismissed] = useState(false)

  const bookRef = useRef<BookReaderHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /* ---------- resolution warning ---------- */

  useEffect(() => {
    function checkResolution() {
      if (resWarningDismissed) return
      if (window.innerWidth < VIEWPORT_WIDTH || window.innerHeight < VIEWPORT_HEIGHT) {
        setShowResWarning(true)
      }
    }

    checkResolution()
    window.addEventListener("resize", checkResolution)
    return () => window.removeEventListener("resize", checkResolution)
  }, [resWarningDismissed])

  function handleDismissWarning() {
    setShowResWarning(false)
    setResWarningDismissed(true)
  }

  /* ---------- load book ---------- */

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!slug) return
      const b = await getBookBySlug(slug)
      if (cancelled) return

      if (!b) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setBook(b)

      const isUnlocked = sessionStorage.getItem("unlocked:" + b.id) === "true"
      if (isUnlocked || !b.passwordHash) {
        setUnlocked(true)
      } else {
        setShowPasswordModal(true)
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  /* ---------- resolve all media URLs ---------- */

  useEffect(() => {
    if (!book || !unlocked) return

    let cancelled = false
    const urls: Record<string, string> = {}

    async function resolveMedia() {
      const ids = new Set<string>()

      for (const spread of book!.spreads) {
        if (spread.leftBackgroundMediaId) ids.add(spread.leftBackgroundMediaId)
        if (spread.rightBackgroundMediaId) ids.add(spread.rightBackgroundMediaId)
        if (spread.fullSpreadBackgroundMediaId) ids.add(spread.fullSpreadBackgroundMediaId)

        for (const el of spread.elements) {
          if (el.type === "image" || el.type === "video" || el.type === "audio") {
            const content = el.content as { mediaId: string }
            if (content.mediaId) ids.add(content.mediaId)
          }
        }
      }

      await Promise.all(
        Array.from(ids).map(async (id) => {
          const url = await getMediaUrl(id)
          if (url) urls[id] = url
        }),
      )

      if (cancelled) {
        Object.values(urls).forEach((u) => URL.revokeObjectURL(u))
        return
      }

      setMediaUrls(urls)
      setMediaReady(true)
    }

    resolveMedia()

    return () => {
      cancelled = true
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [book, unlocked])

  /* ---------- deep-link: ?page=N → step ---------- */

  const initialStep = (() => {
    const pageParam = searchParams.get("page")
    if (!pageParam) return 0
    const pageNum = parseInt(pageParam, 10)
    if (isNaN(pageNum) || pageNum <= 0) return 0
    // Page N lives on step ceil(N/2)
    return Math.ceil(pageNum / 2)
  })()

  /* ---------- handlers ---------- */

  const handleUnlocked = useCallback(() => {
    setUnlocked(true)
    setShowPasswordModal(false)
  }, [])

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step)
  }, [])

  const totalSteps = bookRef.current?.getTotalSteps() ?? (book ? book.spreads.length : 0)

  const handlePrev = useCallback(() => {
    bookRef.current?.flipPrev()
  }, [])

  const handleNext = useCallback(() => {
    bookRef.current?.flipNext()
  }, [])

  const handleViewAll = useCallback(() => {
    setThumbnailModalOpen(true)
  }, [])

  const handleSelectStep = useCallback((step: number) => {
    bookRef.current?.flipToStep(step)
    setThumbnailModalOpen(false)
  }, [])

  /* ---------- keyboard listeners ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          bookRef.current?.flipPrev()
          break
        case "ArrowRight":
          bookRef.current?.flipNext()
          break
        case "Escape":
          setThumbnailModalOpen(false)
          break
      }
    }

    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [])

  /* ---------- auto-focus ---------- */

  useEffect(() => {
    if (unlocked && mediaReady) {
      containerRef.current?.focus()
    }
  }, [unlocked, mediaReady])

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#09090b" }}>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#09090b" }}>
        <p className="text-gray-500 text-sm">Book not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#09090b", padding: 8 }}>
      {showResWarning && <ResolutionWarning onDismiss={handleDismissWarning} />}

      <PasswordModal
        book={book}
        open={showPasswordModal}
        onOpenChange={setShowPasswordModal}
        onUnlocked={handleUnlocked}
      />

      {unlocked && mediaReady && book && (
        <>
          <div
            ref={containerRef}
            tabIndex={0}
            className="relative flex items-center justify-center outline-none w-full h-screen"
          >
            <BookReader
              ref={bookRef}
              book={book}
              initialSpread={initialStep}
              mediaUrls={mediaUrls}
              onStepChange={handleStepChange}
            />
            <NavigationOverlay
              currentStep={currentStep}
              totalSteps={totalSteps}
              onPrev={handlePrev}
              onNext={handleNext}
              onViewAll={handleViewAll}
              onHome={() => router.push("/dashboard")}
              onEdit={() => router.push("/editor/" + book.id)}
            />
          </div>

          <ThumbnailModal
            spreads={book.spreads}
            totalSteps={totalSteps}
            currentStep={currentStep}
            mediaUrls={mediaUrls}
            open={thumbnailModalOpen}
            onOpenChange={setThumbnailModalOpen}
            onSelectStep={handleSelectStep}
          />
        </>
      )}
    </div>
  )
}
