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
/*  BookReader — custom spread viewer with CSS transitions             */
/* ------------------------------------------------------------------ */

const BookReader = React.forwardRef<BookReaderHandle, BookReaderProps>(
  function BookReader({ brochure, initialSpread = 0, mediaUrls, onSpreadChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [currentSpread, setCurrentSpread] = useState(initialSpread)
    const [isAnimating, setIsAnimating] = useState(false)
    const [direction, setDirection] = useState<"next" | "prev" | null>(null)
    const [scale, setScale] = useState(1)
    const reducedMotion = useRef(false)

    const totalSpreads = brochure.spreads.length

    /* ---------- prefers-reduced-motion ---------- */

    useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      reducedMotion.current = mq.matches
      const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches }
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }, [])

    /* ---------- responsive scale ---------- */

    const recalcScale = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const padding = 32 // min margin around the book
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

    /* ---------- navigation ---------- */

    const goToSpread = useCallback((index: number, dir: "next" | "prev") => {
      if (isAnimating) return
      if (index < 0 || index >= totalSpreads) return

      if (reducedMotion.current) {
        setCurrentSpread(index)
        onSpreadChange?.(index)
        return
      }

      setDirection(dir)
      setIsAnimating(true)

      setTimeout(() => {
        setCurrentSpread(index)
        onSpreadChange?.(index)
        setDirection(null)
        setIsAnimating(false)
      }, 500) // match CSS transition duration
    }, [isAnimating, totalSpreads, onSpreadChange])

    /* ---------- imperative handle ---------- */

    useImperativeHandle(ref, () => ({
      flipNext() {
        if (currentSpread >= totalSpreads - 1) {
          // Wrap to cover
          goToSpread(0, "next")
        } else {
          goToSpread(currentSpread + 1, "next")
        }
      },
      flipPrev() {
        if (currentSpread > 0) {
          goToSpread(currentSpread - 1, "prev")
        }
      },
      flipToSpread(index: number) {
        if (index === currentSpread) return
        goToSpread(index, index > currentSpread ? "next" : "prev")
      },
      getCurrentSpread() {
        return currentSpread
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
        if (delta < 0) {
          // Swipe left → next
          if (currentSpread >= totalSpreads - 1) {
            goToSpread(0, "next")
          } else {
            goToSpread(currentSpread + 1, "next")
          }
        } else {
          // Swipe right → prev
          if (currentSpread > 0) {
            goToSpread(currentSpread - 1, "prev")
          }
        }
      }
    }, [currentSpread, totalSpreads, goToSpread])

    /* ---------- animation class ---------- */

    let animationClass = ""
    if (direction === "next") animationClass = "animate-flip-next"
    if (direction === "prev") animationClass = "animate-flip-prev"

    /* ---------- render ---------- */

    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Current spread */}
          <div
            className={`absolute inset-0 transition-transform transition-opacity duration-500 ease-in-out ${animationClass}`}
            style={{ perspective: "1200px" }}
          >
            <SpreadRenderer
              spread={brochure.spreads[currentSpread]}
              mediaUrls={mediaUrls}
            />
          </div>
        </div>

        {/* CSS animations for page flip effect */}
        <style jsx>{`
          .animate-flip-next {
            animation: flipNext 500ms ease-in-out;
          }
          .animate-flip-prev {
            animation: flipPrev 500ms ease-in-out;
          }
          @keyframes flipNext {
            0% { transform: rotateY(0deg); opacity: 1; }
            50% { transform: rotateY(-90deg); opacity: 0.5; }
            100% { transform: rotateY(0deg); opacity: 1; }
          }
          @keyframes flipPrev {
            0% { transform: rotateY(0deg); opacity: 1; }
            50% { transform: rotateY(90deg); opacity: 0.5; }
            100% { transform: rotateY(0deg); opacity: 1; }
          }
        `}</style>
      </div>
    )
  },
)

BookReader.displayName = "BookReader"

export default BookReader
