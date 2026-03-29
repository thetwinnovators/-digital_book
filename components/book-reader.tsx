"use client"

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import SpreadRenderer from "@/components/spread-renderer"
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants"
import type { Brochure } from "@/lib/types"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BookReaderHandle {
  flipNext: () => void
  flipPrev: () => void
  flipToSpread: (spreadIndex: number) => void
  getCurrentSpread: () => number
}

interface BookReaderProps {
  brochure: Brochure
  initialSpread?: number
  mediaUrls: Record<string, string>
  onSpreadChange?: (spreadIndex: number) => void
}

/* ------------------------------------------------------------------ */
/*  BookReader — CSS 3D leaf-based page flip                           */
/* ------------------------------------------------------------------ */

const BookReader = React.forwardRef<BookReaderHandle, BookReaderProps>(
  function BookReader({ brochure, initialSpread = 0, mediaUrls, onSpreadChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [currentSpread, setCurrentSpread] = useState(initialSpread)
    const currentSpreadRef = useRef(initialSpread)
    const [scale, setScale] = useState(1)

    const totalSpreads = brochure.spreads.length

    // Track which leaves are flipped. Each "leaf" sits between two spreads.
    // Leaf i is flipped when we've moved past spread i (i.e., currentSpread > i).
    // We build leaves from consecutive spread pairs.
    const [flippedSet, setFlippedSet] = useState<Set<number>>(() => {
      const set = new Set<number>()
      for (let i = 0; i < initialSpread; i++) set.add(i)
      return set
    })
    const flippedSetRef = useRef(flippedSet)

    /* ---------- responsive scale ---------- */

    const recalcScale = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const padding = 32
      const availW = el.clientWidth - padding * 2
      const availH = el.clientHeight - padding * 2
      const s = Math.min(availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT, 1)
      setScale(s)
    }, [])

    useEffect(() => {
      recalcScale()
      window.addEventListener("resize", recalcScale)
      return () => window.removeEventListener("resize", recalcScale)
    }, [recalcScale])

    /* ---------- navigation logic ---------- */

    const goToSpread = useCallback((index: number) => {
      if (index < 0 || index >= totalSpreads) return
      if (index === currentSpreadRef.current) return

      const newFlipped = new Set<number>()
      // All leaves before the target spread are flipped
      for (let i = 0; i < index; i++) newFlipped.add(i)

      currentSpreadRef.current = index
      flippedSetRef.current = newFlipped
      setCurrentSpread(index)
      setFlippedSet(newFlipped)
      onSpreadChange?.(index)
    }, [totalSpreads, onSpreadChange])

    /* ---------- imperative handle ---------- */

    useImperativeHandle(ref, () => ({
      flipNext() {
        const cur = currentSpreadRef.current
        if (cur >= totalSpreads - 1) {
          goToSpread(0) // wrap to cover
        } else {
          goToSpread(cur + 1)
        }
      },
      flipPrev() {
        const cur = currentSpreadRef.current
        if (cur > 0) goToSpread(cur - 1)
      },
      flipToSpread(index: number) {
        goToSpread(index)
      },
      getCurrentSpread() {
        return currentSpreadRef.current
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
        const cur = currentSpreadRef.current
        if (delta < 0) {
          // Swipe left → next
          goToSpread(cur >= totalSpreads - 1 ? 0 : cur + 1)
        } else {
          // Swipe right → prev
          if (cur > 0) goToSpread(cur - 1)
        }
      }
    }, [totalSpreads, goToSpread])

    /* ---------- render ---------- */

    // Build leaves: each leaf has a front face (spread i) and back face (spread i+1).
    // The last spread doesn't need a leaf after it.
    // Leaf 0: front = spread 0, back = spread 1
    // Leaf 1: front = spread 1, back = spread 2
    // etc.
    // When leaf i is flipped (rotateY -180deg), the back face (spread i+1) becomes visible.

    const leaves: { frontIndex: number; backIndex: number }[] = []
    for (let i = 0; i < totalSpreads - 1; i++) {
      leaves.push({ frontIndex: i, backIndex: i + 1 })
    }

    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Book container with perspective */}
        <div
          className="book-container"
          style={{ perspective: "2500px" }}
        >
          <div
            className="book"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              overflow: "hidden",
            }}
          >
            {/* Base layer: show the last visible spread (current) as background */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <SpreadRenderer
                spread={brochure.spreads[currentSpread]}
                mediaUrls={mediaUrls}
              />
            </div>

            {/* Leaves stack — each leaf flips to reveal the next spread */}
            {leaves.map((leaf, i) => {
              const isFlipped = flippedSet.has(i)
              // z-index: unflipped leaves stack highest-first (so leaf 0 is on top)
              // flipped leaves stack lowest-first
              const zIndex = isFlipped ? i + 1 : totalSpreads - i

              return (
                <div
                  key={i}
                  className="leaf"
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformOrigin: "left center",
                    transformStyle: "preserve-3d",
                    transition: "transform 1s cubic-bezier(0.645, 0.045, 0.355, 1)",
                    transform: isFlipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                    zIndex,
                  }}
                >
                  {/* Front face: shows spread[frontIndex] */}
                  <div
                    className="face-front"
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <SpreadRenderer
                      spread={brochure.spreads[leaf.frontIndex]}
                      mediaUrls={mediaUrls}
                    />
                  </div>

                  {/* Back face: shows spread[backIndex] (mirrored) */}
                  <div
                    className="face-back"
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <SpreadRenderer
                      spread={brochure.spreads[leaf.backIndex]}
                      mediaUrls={mediaUrls}
                    />
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
