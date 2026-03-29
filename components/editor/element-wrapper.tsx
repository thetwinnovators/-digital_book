"use client"

import React, { useCallback, useRef, useState } from "react"
import { Lock } from "lucide-react"
import { GRID_SIZE } from "@/lib/constants"
import { sanitizeHtml } from "@/lib/sanitize"
import type { BrochureElement, TextContent, ImageContent } from "@/lib/types"

interface ElementWrapperProps {
  element: BrochureElement
  selected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<BrochureElement>) => void
  mediaUrls: Record<string, string>
  siblingElements: BrochureElement[]
}

interface GuideLine {
  axis: "x" | "y"
  position: number
}

const MIN_SIZE = 40

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

const HANDLE_POSITIONS = [
  { name: "tl", cursor: "nwse-resize", style: { top: -4, left: -4 } },
  { name: "tc", cursor: "ns-resize", style: { top: -4, left: "calc(50% - 4px)" } },
  { name: "tr", cursor: "nesw-resize", style: { top: -4, right: -4 } },
  { name: "ml", cursor: "ew-resize", style: { top: "calc(50% - 4px)", left: -4 } },
  { name: "mr", cursor: "ew-resize", style: { top: "calc(50% - 4px)", right: -4 } },
  { name: "bl", cursor: "nesw-resize", style: { bottom: -4, left: -4 } },
  { name: "bc", cursor: "ns-resize", style: { bottom: -4, left: "calc(50% - 4px)" } },
  { name: "br", cursor: "nwse-resize", style: { bottom: -4, right: -4 } },
] as const

const SNAP_THRESHOLD = 5

export default function ElementWrapper({
  element,
  selected,
  onSelect,
  onUpdate,
  mediaUrls,
  siblingElements,
}: ElementWrapperProps) {
  const [guideLines, setGuideLines] = useState<GuideLine[]>([])
  const isDragging = useRef(false)
  const isResizing = useRef(false)

  const findSnapLines = useCallback(
    (x: number, y: number, w: number, h: number): { snappedX: number; snappedY: number; lines: GuideLine[] } => {
      const lines: GuideLine[] = []
      let snappedX = x
      let snappedY = y

      const myEdges = {
        left: x,
        right: x + w,
        centerX: x + w / 2,
        top: y,
        bottom: y + h,
        centerY: y + h / 2,
      }

      for (const sib of siblingElements) {
        if (sib.id === element.id) continue
        const sibEdges = {
          left: sib.x,
          right: sib.x + sib.width,
          centerX: sib.x + sib.width / 2,
          top: sib.y,
          bottom: sib.y + sib.height,
          centerY: sib.y + sib.height / 2,
        }

        // X-axis snapping
        const xPairs: [number, number][] = [
          [myEdges.left, sibEdges.left],
          [myEdges.left, sibEdges.right],
          [myEdges.right, sibEdges.left],
          [myEdges.right, sibEdges.right],
          [myEdges.centerX, sibEdges.centerX],
        ]
        for (const [myVal, sibVal] of xPairs) {
          if (Math.abs(myVal - sibVal) < SNAP_THRESHOLD) {
            snappedX = x + (sibVal - myVal)
            lines.push({ axis: "x", position: sibVal })
            break
          }
        }

        // Y-axis snapping
        const yPairs: [number, number][] = [
          [myEdges.top, sibEdges.top],
          [myEdges.top, sibEdges.bottom],
          [myEdges.bottom, sibEdges.top],
          [myEdges.bottom, sibEdges.bottom],
          [myEdges.centerY, sibEdges.centerY],
        ]
        for (const [myVal, sibVal] of yPairs) {
          if (Math.abs(myVal - sibVal) < SNAP_THRESHOLD) {
            snappedY = y + (sibVal - myVal)
            lines.push({ axis: "y", position: sibVal })
            break
          }
        }
      }

      return { snappedX, snappedY, lines }
    },
    [element.id, siblingElements]
  )

  const handleMouseDownMove = useCallback(
    (e: React.MouseEvent) => {
      if (element.locked || isResizing.current) return
      e.stopPropagation()
      e.preventDefault()

      isDragging.current = true
      const startMouseX = e.clientX
      const startMouseY = e.clientY
      const startX = element.x
      const startY = element.y

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startMouseX
        const dy = ev.clientY - startMouseY
        const rawX = snapToGrid(startX + dx)
        const rawY = snapToGrid(startY + dy)

        const { snappedX, snappedY, lines } = findSnapLines(rawX, rawY, element.width, element.height)
        setGuideLines(lines)
        onUpdate({ x: snappedX, y: snappedY })
      }

      const onMouseUp = () => {
        isDragging.current = false
        setGuideLines([])
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    },
    [element.locked, element.x, element.y, element.width, element.height, onUpdate, findSnapLines]
  )

  const handleMouseDownResize = useCallback(
    (e: React.MouseEvent, handle: string) => {
      if (element.locked) return
      e.stopPropagation()
      e.preventDefault()

      isResizing.current = true
      const startMouseX = e.clientX
      const startMouseY = e.clientY
      const startX = element.x
      const startY = element.y
      const startW = element.width
      const startH = element.height

      const resizesLeft = handle.includes("l")
      const resizesRight = handle.includes("r")
      const resizesTop = handle.includes("t")
      const resizesBottom = handle.includes("b")

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startMouseX
        const dy = ev.clientY - startMouseY

        let newX = startX
        let newY = startY
        let newW = startW
        let newH = startH

        if (resizesRight) {
          newW = snapToGrid(Math.max(MIN_SIZE, startW + dx))
        }
        if (resizesLeft) {
          const proposedW = snapToGrid(Math.max(MIN_SIZE, startW - dx))
          newX = startX + (startW - proposedW)
          newW = proposedW
        }
        if (resizesBottom) {
          newH = snapToGrid(Math.max(MIN_SIZE, startH + dy))
        }
        if (resizesTop) {
          const proposedH = snapToGrid(Math.max(MIN_SIZE, startH - dy))
          newY = startY + (startH - proposedH)
          newH = proposedH
        }

        onUpdate({ x: newX, y: newY, width: newW, height: newH })
      }

      const onMouseUp = () => {
        isResizing.current = false
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    },
    [element.locked, element.x, element.y, element.width, element.height, onUpdate]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect()
    },
    [onSelect]
  )

  // Content rendering
  // All user-generated HTML is sanitized with DOMPurify via sanitizeHtml() before rendering
  let contentNode: React.ReactNode = null
  if (element.type === "text") {
    const content = element.content as TextContent
    const sanitized = sanitizeHtml(content.html)
    contentNode = (
      <div
        style={{
          fontFamily: content.fontFamily,
          fontSize: `${content.fontSize}px`,
          color: content.color,
          fontWeight: content.fontWeight,
          textAlign: content.alignment as React.CSSProperties["textAlign"],
          lineHeight: content.lineHeight,
          letterSpacing: `${content.letterSpacing}px`,
          opacity: content.opacity,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  } else if (element.type === "image") {
    const content = element.content as ImageContent
    const src = mediaUrls[content.mediaId]
    contentNode = src ? (
      <img
        src={src}
        alt=""
        className="w-full h-full pointer-events-none"
        style={{ objectFit: content.objectFit }}
        draggable={false}
      />
    ) : (
      <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-xs">
        No image
      </div>
    )
  }

  return (
    <>
      <div
        onClick={handleClick}
        onMouseDown={handleMouseDownMove}
        style={{
          position: "absolute",
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: element.rotation !== 0 ? `rotate(${element.rotation}deg)` : undefined,
          zIndex: element.zIndex,
          cursor: element.locked ? "not-allowed" : "move",
        }}
        className={selected ? "border-2 border-dashed border-blue-500" : ""}
      >
        {contentNode}

        {element.locked && (
          <div className="absolute top-1 right-1 bg-zinc-900/80 rounded p-0.5">
            <Lock className="w-3 h-3 text-zinc-400" />
          </div>
        )}

        {selected && !element.locked &&
          HANDLE_POSITIONS.map((hp) => (
            <div
              key={hp.name}
              onMouseDown={(e) => handleMouseDownResize(e, hp.name)}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                backgroundColor: "#3b82f6",
                cursor: hp.cursor,
                ...hp.style,
              }}
            />
          ))}
      </div>

      {/* Alignment guide lines */}
      {guideLines.map((line, i) =>
        line.axis === "x" ? (
          <div
            key={`guide-${i}`}
            style={{
              position: "absolute",
              left: line.position,
              top: 0,
              width: 1,
              height: "100%",
              zIndex: 9999,
            }}
            className="bg-blue-400 pointer-events-none"
          />
        ) : (
          <div
            key={`guide-${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: line.position,
              width: "100%",
              height: 1,
              zIndex: 9999,
            }}
            className="bg-blue-400 pointer-events-none"
          />
        )
      )}
    </>
  )
}
