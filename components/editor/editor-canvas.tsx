"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { CANVAS_WIDTH, CANVAS_HEIGHT, PAGE_WIDTH } from "@/lib/constants"
import type { Spread, BookElement } from "@/lib/types"
import ElementWrapper from "@/components/editor/element-wrapper"

interface EditorCanvasProps {
  spread: Spread
  selectedElementId: string | null
  onSelectElement: (id: string | null) => void
  onUpdateElement: (id: string, updates: Partial<BookElement>) => void
  mediaUrls: Record<string, string>
}

export default function EditorCanvas({
  spread,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  mediaUrls,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const rect = container.getBoundingClientRect()
      const padding = 16
      const availableW = rect.width - padding * 2
      const availableH = rect.height - padding * 2
      const newScale = Math.min(availableW / CANVAS_WIDTH, availableH / CANVAS_HEIGHT)
      setScale(Math.max(0.1, newScale))
    }

    updateScale()

    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleCanvasClick = useCallback(() => {
    onSelectElement(null)
  }, [onSelectElement])

  // Sort elements by zIndex ascending
  const sortedElements = [...spread.elements].sort((a, b) => a.zIndex - b.zIndex)

  // Determine backgrounds
  let leftBg: React.ReactNode = null
  let rightBg: React.ReactNode = null

  if (spread.fullSpreadBackgroundMediaId && mediaUrls[spread.fullSpreadBackgroundMediaId]) {
    const src = mediaUrls[spread.fullSpreadBackgroundMediaId]
    leftBg = (
      <img
        src={src}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          objectFit: "cover",
        }}
        draggable={false}
      />
    )
    // Right side is part of the same full-spread image, no separate node needed
  } else {
    if (spread.leftBackgroundMediaId && mediaUrls[spread.leftBackgroundMediaId]) {
      leftBg = (
        <img
          src={mediaUrls[spread.leftBackgroundMediaId]}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: PAGE_WIDTH,
            height: CANVAS_HEIGHT,
            objectFit: "cover",
          }}
          draggable={false}
        />
      )
    }
    if (spread.rightBackgroundMediaId && mediaUrls[spread.rightBackgroundMediaId]) {
      rightBg = (
        <img
          src={mediaUrls[spread.rightBackgroundMediaId]}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: PAGE_WIDTH,
            width: PAGE_WIDTH,
            height: CANVAS_HEIGHT,
            objectFit: "cover",
          }}
          draggable={false}
        />
      )
    }
  }

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden">
      <div
        style={{
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
          flexShrink: 0,
        }}
      >
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="relative bg-zinc-800"
        onClick={handleCanvasClick}
      >
        {/* Backgrounds */}
        {leftBg}
        {rightBg}

        {/* Center divider line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: PAGE_WIDTH,
            width: 0,
            height: CANVAS_HEIGHT,
            borderRight: "1px solid",
            zIndex: 9998,
            pointerEvents: "none",
          }}
          className="border-zinc-600"
        />

        {/* Elements */}
        {sortedElements.map((el) => (
          <ElementWrapper
            key={el.id}
            element={el}
            selected={selectedElementId === el.id}
            onSelect={() => onSelectElement(el.id)}
            onUpdate={(updates) => onUpdateElement(el.id, updates)}
            mediaUrls={mediaUrls}
            siblingElements={spread.elements}
          />
        ))}
      </div>
      </div>
    </div>
  )
}
