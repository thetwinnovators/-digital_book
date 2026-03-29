"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Home, LayoutGrid } from "lucide-react"
import { NAV_OVERLAY_TIMEOUT_MS } from "@/lib/constants"
import type { Spread } from "@/lib/types"

interface NavigationOverlayProps {
  currentSpreadIndex: number
  totalSpreads: number
  spreads: Spread[]
  onPrev: () => void
  onNext: () => void
  onCover: () => void
  onViewAll: () => void
}

export default function NavigationOverlay({
  currentSpreadIndex,
  totalSpreads,
  spreads,
  onPrev,
  onNext,
  onCover,
  onViewAll,
}: NavigationOverlayProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(true)
    timeoutRef.current = setTimeout(() => setVisible(false), NAV_OVERLAY_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleInteraction = useCallback(() => {
    resetTimeout()
  }, [resetTimeout])

  const isCover = currentSpreadIndex === 0
  const currentSpread = spreads[currentSpreadIndex]
  let pageLabel: string
  if (isCover) {
    pageLabel = "Cover"
  } else if (currentSpread) {
    pageLabel = `Pages ${currentSpread.leftPageLabel}-${currentSpread.rightPageLabel} of ${(totalSpreads - 1) * 2}`
  } else {
    pageLabel = ""
  }

  return (
    <div
      className="absolute inset-0 z-10"
      onMouseMove={handleInteraction}
      onFocus={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={isCover}
            className="pointer-events-auto text-white disabled:text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Previous spread"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="pointer-events-auto text-white text-sm whitespace-nowrap select-none">
            {pageLabel}
          </span>

          <button
            type="button"
            onClick={onNext}
            className="pointer-events-auto text-white hover:text-zinc-300 transition-colors"
            aria-label="Next spread"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onCover}
            className="pointer-events-auto text-white hover:text-zinc-300 transition-colors"
            aria-label="Go to cover"
          >
            <Home className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onViewAll}
            className="pointer-events-auto text-white hover:text-zinc-300 transition-colors"
            aria-label="View all pages"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
