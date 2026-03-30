"use client"

import React from "react"
import PageRenderer from "@/components/page-renderer"
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants"
import type { Spread } from "@/lib/types"

interface SpreadRendererProps {
  spread: Spread
  mediaUrls: Record<string, string>
  className?: string
}

/**
 * Renders a full two-page spread (1440x812) by placing left and right
 * PageRenderer components side-by-side. Used by the book reader so that
 * each "page" in the flipbook is an entire spread.
 */
const SpreadRenderer = React.forwardRef<HTMLDivElement, SpreadRendererProps>(
  function SpreadRenderer({ spread, mediaUrls, className }, ref) {
    return (
      <div
        ref={ref}
        className={`flex${className ? ` ${className}` : ""}`}
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        <PageRenderer spread={spread} side="left" mediaUrls={mediaUrls} />
        <PageRenderer spread={spread} side="right" mediaUrls={mediaUrls} />
      </div>
    )
  },
)

SpreadRenderer.displayName = "SpreadRenderer"

export default SpreadRenderer
