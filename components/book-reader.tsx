"use client"

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import PageRenderer from "@/components/page-renderer"
import { CANVAS_WIDTH, CANVAS_HEIGHT, PAGE_WIDTH, VIEWPORT_MARGIN } from "@/lib/constants"
import type { Book } from "@/lib/types"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BookReaderHandle {
  flipNext: () => void
  flipPrev: () => void
  flipToStep: (step: number) => void
  getCurrentStep: () => number
  getTotalSteps: () => number
}

interface BookReaderProps {
  book: Book
  initialSpread?: number
  mediaUrls: Record<string, string>
  onStepChange?: (step: number) => void
}

/* ------------------------------------------------------------------ */
/*  BookReader — center-spine page flip                                */
/* ------------------------------------------------------------------ */

const BookReader = React.forwardRef<BookReaderHandle, BookReaderProps>(
  function BookReader({ book, initialSpread = 0, mediaUrls, onStepChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    const totalSpreads = book.spreads.length
    const innerSpreads = totalSpreads > 1 ? totalSpreads - 1 : 0
    const totalSteps = innerSpreads + 1 // cover + inner spreads (no standalone back cover)

    const initialStep = initialSpread
    const [currentStep, setCurrentStep] = useState(initialStep)
    const currentStepRef = useRef(initialStep)

    // Leaves: one per transition between steps. totalSteps - 1 leaves.
    // Each leaf is a HALF-PAGE (720×810), positioned at the spine (left: 720).
    // Leaf i: front = right page of step i, back = left page of step i+1
    const totalLeaves = totalSteps - 1

    const [flippedSet, setFlippedSet] = useState<Set<number>>(() => {
      const set = new Set<number>()
      for (let i = 0; i < initialStep; i++) set.add(i)
      return set
    })
    const flippedSetRef = useRef(flippedSet)

    // Track the currently animating leaf so it keeps an elevated z-index
    // until the CSS transition completes (1s).
    const [animatingLeaf, setAnimatingLeaf] = useState<number | null>(null)
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    /* ---------- responsive scale ---------- */

    const recalcScale = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const margin = 40
      const availW = el.clientWidth - margin * 2
      const availH = el.clientHeight - margin * 2
      const s = Math.min(availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT)
      setScale(s)
    }, [])

    useEffect(() => {
      recalcScale()
      window.addEventListener("resize", recalcScale)
      return () => window.removeEventListener("resize", recalcScale)
    }, [recalcScale])

    useEffect(() => {
      return () => {
        if (animTimerRef.current) clearTimeout(animTimerRef.current)
      }
    }, [])

    /* ---------- navigation logic ---------- */

    const bookContainerRef = useRef<HTMLDivElement>(null)

    const pauseAllMedia = useCallback(() => {
      if (!bookContainerRef.current) return
      bookContainerRef.current.querySelectorAll("video, audio").forEach((el) => {
        const media = el as HTMLMediaElement
        if (!media.paused) media.pause()
      })
    }, [])

    const goToStep = useCallback((step: number) => {
      if (step < 0 || step >= totalSteps) return
      if (step === currentStepRef.current) return

      // Pause all playing media before flipping
      pauseAllMedia()

      // Determine which leaf is transitioning
      const prevStep = currentStepRef.current
      const leafIndex = step > prevStep ? prevStep : step // forward: prev leaf flips; backward: target leaf unflips

      const newFlipped = new Set<number>()
      for (let i = 0; i < step; i++) newFlipped.add(i)

      // Elevate the animating leaf's z-index during the 1s transition
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      setAnimatingLeaf(leafIndex)
      animTimerRef.current = setTimeout(() => {
        setAnimatingLeaf(null)
      }, 1050) // slightly longer than 1s CSS transition

      currentStepRef.current = step
      flippedSetRef.current = newFlipped
      setCurrentStep(step)
      setFlippedSet(newFlipped)
      onStepChange?.(step)
    }, [totalSteps, onStepChange])

    /* ---------- imperative handle ---------- */

    useImperativeHandle(ref, () => ({
      flipNext() {
        const cur = currentStepRef.current
        if (cur < totalSteps - 1) {
          goToStep(cur + 1)
        } else {
          goToStep(0) // wrap back to cover
        }
      },
      flipPrev() {
        const cur = currentStepRef.current
        if (cur > 0) goToStep(cur - 1)
      },
      flipToStep(step: number) {
        goToStep(step)
      },
      getCurrentStep() {
        return currentStepRef.current
      },
      getTotalSteps() {
        return totalSteps
      },
    }))

    /* ---------- swipe support ---------- */

    const touchStartX = useRef(0)

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      const delta = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(delta) > 50) {
        const cur = currentStepRef.current
        if (delta < 0 && cur < totalSteps - 1) {
          goToStep(cur + 1)
        } else if (delta > 0 && cur > 0) {
          goToStep(cur - 1)
        }
      }
    }, [totalSteps, goToStep])

    /* ---------- render helpers ---------- */

    // Render the LEFT page of a given step
    function renderLeftPage(step: number) {
      if (step === 0) {
        // Cover left = left side of cover spread (spread[0])
        const coverSpread = book.spreads[0]
        return (
          <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="relative">
            <PageRenderer spread={coverSpread} side="left" mediaUrls={mediaUrls} />
          </div>
        )
      }

      // Inner spread left page
      const spread = book.spreads[step]
      if (!spread) return <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="bg-zinc-800" />

      return (
        <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="relative">
          <PageRenderer spread={spread} side="left" mediaUrls={mediaUrls} pageNumber={(step - 1) * 2 + 1} />
          {/* Page number — odd, bottom-left */}
          <div className="absolute bottom-0 left-0 px-4 pb-4 text-gray-400 text-xs font-semibold" style={{ zIndex: 10 }}>
            {(step - 1) * 2 + 1}
          </div>
        </div>
      )
    }

    // Render the RIGHT page of a given step
    function renderRightPage(step: number) {
      if (step === 0) {
        // Cover right = front cover (first spread)
        const frontSpread = book.spreads[0]
        return (
          <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="relative">
            <PageRenderer spread={frontSpread} side="right" mediaUrls={mediaUrls} />
          </div>
        )
      }

      // Inner spread right page
      const spread = book.spreads[step]
      if (!spread) return <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="bg-zinc-800" />

      return (
        <div style={{ width: PAGE_WIDTH, height: CANVAS_HEIGHT }} className="relative">
          <PageRenderer spread={spread} side="right" mediaUrls={mediaUrls} pageNumber={(step - 1) * 2 + 2} />
          {/* Page number — even, bottom-right */}
          <div className="absolute bottom-0 right-0 px-4 pb-4 text-gray-400 text-xs font-semibold" style={{ zIndex: 10 }}>
            {(step - 1) * 2 + 2}
          </div>
        </div>
      )
    }

    /* ---------- render ---------- */

    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="book-perspective"
          style={{
            width: CANVAS_WIDTH * scale,
            height: CANVAS_HEIGHT * scale,
            flexShrink: 0,
            overflow: "visible", // allow flipping pages to extend beyond bounds for 3D
          }}
        >
          <div
            ref={bookContainerRef}
            className="book-3d"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              position: "relative",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              // perspective applied here so leaves get one-point 3D from spine
              perspective: 1800,
              perspectiveOrigin: `${PAGE_WIDTH}px 50%`, // origin at the spine
            }}
          >
            {/* Base layer: static — step 0 left + last step right.
                Leaves fully control visible content at each step. */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex" }}>
              {renderLeftPage(0)}
              {renderRightPage(totalSteps - 1)}
            </div>

            {/* Leaf stack — half-page leaves hinged at the center spine */}
            {Array.from({ length: totalLeaves }, (_, i) => {
              const isFlipped = flippedSet.has(i)
              const isAnimating = animatingLeaf === i

              // The currently animating leaf gets the highest z-index so it
              // stays on top of all other leaves for the full duration of its
              // CSS transition.  Other leaves use the normal stacking order.
              let zIndex: number
              if (isAnimating) {
                zIndex = totalLeaves + 10 // always on top during animation
              } else if (isFlipped) {
                zIndex = i + 1
              } else {
                zIndex = totalLeaves + 1 - i
              }

              return (
                <div
                  key={i}
                  className={`book-leaf${isFlipped ? " flipped" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: PAGE_WIDTH, // positioned at the spine
                    width: PAGE_WIDTH,
                    height: CANVAS_HEIGHT,
                    zIndex,
                  }}
                >
                  {/* Front face: right page of step i */}
                  <div className="book-face">
                    {renderRightPage(i)}
                  </div>

                  {/* Back face: left page of step i+1 */}
                  <div className="book-face-back">
                    {renderLeftPage(i + 1)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  },
)

BookReader.displayName = "BookReader"

export default BookReader
