"use client"

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
// @ts-ignore -- react-pageflip has incomplete type declarations
import HTMLFlipBook from "react-pageflip"
import PageRenderer from "@/components/page-renderer"
import { PAGE_WIDTH, PAGE_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants"
import type { Brochure, Spread } from "@/lib/types"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FlatPage {
  spread: Spread
  side: "left" | "right"
}

export interface BookReaderHandle {
  flipNext: () => void
  flipPrev: () => void
  flipToPage: (pageIndex: number) => void
  getCurrentPage: () => number
}

interface BookReaderProps {
  brochure: Brochure
  initialPage?: number
  mediaUrls: Record<string, string>
  onPageChange?: (pageIndex: number) => void
}

/* ------------------------------------------------------------------ */
/*  Single page wrapper — must be forwardRef for react-pageflip        */
/* ------------------------------------------------------------------ */

const FlipPage = React.forwardRef<
  HTMLDivElement,
  { spread: Spread; side: "left" | "right"; mediaUrls: Record<string, string> }
>(function FlipPage({ spread, side, mediaUrls }, ref) {
  return (
    <PageRenderer
      ref={ref}
      spread={spread}
      side={side}
      mediaUrls={mediaUrls}
    />
  )
})

FlipPage.displayName = "FlipPage"

/* ------------------------------------------------------------------ */
/*  BookReader                                                         */
/* ------------------------------------------------------------------ */

const BookReader = React.forwardRef<BookReaderHandle, BookReaderProps>(
  function BookReader({ brochure, initialPage, mediaUrls, onPageChange }, ref) {
    const flipBookRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    const [currentPage, setCurrentPage] = useState(0)
    const [flippingTime, setFlippingTime] = useState(800)

    /* ---------- prefers-reduced-motion ---------- */

    useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      if (mq.matches) {
        setFlippingTime(0)
      }
      const handler = (e: MediaQueryListEvent) => {
        setFlippingTime(e.matches ? 0 : 800)
      }
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }, [])

    /* ---------- flatten spreads into individual pages ---------- */

    const flatPages: FlatPage[] = React.useMemo(() => {
      const pages: FlatPage[] = []
      for (const spread of brochure.spreads) {
        pages.push({ spread, side: "left" })
        pages.push({ spread, side: "right" })
      }
      return pages
    }, [brochure.spreads])

    /* ---------- scale calculation ---------- */

    const recalcScale = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const containerWidth = el.clientWidth
      const containerHeight = el.clientHeight
      // The book shows two pages side by side → total width = CANVAS_WIDTH
      const s = Math.min(containerWidth / CANVAS_WIDTH, containerHeight / CANVAS_HEIGHT)
      setScale(s)
    }, [])

    useEffect(() => {
      recalcScale()
      window.addEventListener("resize", recalcScale)
      return () => window.removeEventListener("resize", recalcScale)
    }, [recalcScale])

    /* ---------- initial page ---------- */

    useEffect(() => {
      if (initialPage != null && initialPage > 0) {
        // react-pageflip needs a tick to initialise before we can flip
        const timer = setTimeout(() => {
          flipBookRef.current?.pageFlip()?.flip(initialPage)
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [initialPage])

    /* ---------- imperative handle ---------- */

    useImperativeHandle(ref, () => ({
      flipNext() {
        flipBookRef.current?.pageFlip()?.flipNext()
      },
      flipPrev() {
        flipBookRef.current?.pageFlip()?.flipPrev()
      },
      flipToPage(pageIndex: number) {
        flipBookRef.current?.pageFlip()?.flip(pageIndex)
      },
      getCurrentPage() {
        return currentPage
      },
    }))

    /* ---------- onFlip ---------- */

    const handleFlip = useCallback(
      (e: { data: number }) => {
        setCurrentPage(e.data)
        onPageChange?.(e.data)
      },
      [onPageChange],
    )

    /* ---------- render ---------- */

    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full h-full"
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* @ts-ignore — react-pageflip JSX type issues */}
          <HTMLFlipBook
            ref={flipBookRef}
            width={PAGE_WIDTH}
            height={PAGE_HEIGHT}
            showCover={true}
            flippingTime={flippingTime}
            useMouseEvents={true}
            swipeDistance={30}
            maxShadowOpacity={0.5}
            onFlip={handleFlip}
          >
            {flatPages.map((page, idx) => (
              <FlipPage
                key={`${page.spread.id}-${page.side}-${idx}`}
                spread={page.spread}
                side={page.side}
                mediaUrls={mediaUrls}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>
    )
  },
)

BookReader.displayName = "BookReader"

export default BookReader
