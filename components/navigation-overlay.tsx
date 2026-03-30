"use client"

import { ChevronLeft, ChevronRight, Home, LayoutGrid, Pencil } from "lucide-react"

interface NavigationOverlayProps {
  currentStep: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
  onViewAll: () => void
  onHome: () => void
  onEdit?: () => void
}

export default function NavigationOverlay({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onViewAll,
  onHome,
  onEdit,
}: NavigationOverlayProps) {
  const isCover = currentStep === 0

  // Page indicator text
  let pageLabel: string
  if (isCover) {
    pageLabel = "Cover"
  } else {
    const leftPage = (currentStep - 1) * 2 + 1
    const rightPage = (currentStep - 1) * 2 + 2
    pageLabel = `Pages ${leftPage} - ${rightPage}`
  }

  return (
    <div className="absolute inset-0 z-20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-zinc-800/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
          {/* Previous button */}
          <button
            type="button"
            onClick={onPrev}
            disabled={isCover}
            className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-zinc-700 disabled:text-zinc-500 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Next button */}
          <button
            type="button"
            onClick={onNext}
            className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-zinc-700 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Page indicator */}
          <span className="text-white text-sm font-medium whitespace-nowrap select-none">
            {pageLabel}
          </span>

          {/* View All button */}
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-zinc-700 transition-colors"
            aria-label="View all pages"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>

          {/* Home / back to gallery */}
          <button
            type="button"
            onClick={onHome}
            className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-zinc-700 transition-colors"
            aria-label="Back to gallery"
          >
            <Home className="h-4 w-4" />
          </button>

          {/* Back to edit mode */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:bg-zinc-700 transition-colors"
              aria-label="Back to editor"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
