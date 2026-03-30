"use client"

import { useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import type { Spread } from "@/lib/types"

interface SpreadStripProps {
  spreads: Spread[]
  currentIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  mediaUrls: Record<string, string>
}

export default function SpreadStrip({
  spreads,
  currentIndex,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
  mediaUrls,
}: SpreadStripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const dragStartX = useRef(0)

  function handleDragStart(e: React.DragEvent, index: number) {
    // Don't allow dragging the cover
    if (index === 0) {
      e.preventDefault()
      return
    }
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(index))
    dragStartX.current = e.clientX
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || index === 0 || index === dragIndex) {
      setDropTarget(null)
      return
    }
    e.dataTransfer.dropEffect = "move"
    setDropTarget(index)
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== toIndex && toIndex !== 0) {
      onReorder(dragIndex, toIndex)
    }
    setDragIndex(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDropTarget(null)
  }

  function getSpreadBgUrl(spread: Spread): string | null {
    if (spread.fullSpreadBackgroundMediaId && mediaUrls[spread.fullSpreadBackgroundMediaId]) {
      return mediaUrls[spread.fullSpreadBackgroundMediaId]
    }
    if (spread.leftBackgroundMediaId && mediaUrls[spread.leftBackgroundMediaId]) {
      return mediaUrls[spread.leftBackgroundMediaId]
    }
    if (spread.rightBackgroundMediaId && mediaUrls[spread.rightBackgroundMediaId]) {
      return mediaUrls[spread.rightBackgroundMediaId]
    }
    return null
  }

  function getLeftBgUrl(spread: Spread): string | null {
    if (spread.fullSpreadBackgroundMediaId && mediaUrls[spread.fullSpreadBackgroundMediaId]) {
      return mediaUrls[spread.fullSpreadBackgroundMediaId]
    }
    if (spread.leftBackgroundMediaId && mediaUrls[spread.leftBackgroundMediaId]) {
      return mediaUrls[spread.leftBackgroundMediaId]
    }
    return null
  }

  function getRightBgUrl(spread: Spread): string | null {
    if (spread.fullSpreadBackgroundMediaId && mediaUrls[spread.fullSpreadBackgroundMediaId]) {
      return mediaUrls[spread.fullSpreadBackgroundMediaId]
    }
    if (spread.rightBackgroundMediaId && mediaUrls[spread.rightBackgroundMediaId]) {
      return mediaUrls[spread.rightBackgroundMediaId]
    }
    return null
  }

  return (
    <div className="h-24 overflow-x-auto flex gap-2 p-2 items-center">
      {spreads.map((spread, index) => {
        const isCover = index === 0
        const leftLabel = spread.leftPageLabel || (isCover ? "Cover" : String(index * 2 - 1))
        const rightLabel = spread.rightPageLabel || (isCover ? "" : String(index * 2))
        const label = isCover ? "Cover" : `Pages ${leftLabel}-${rightLabel}`
        const isSelected = index === currentIndex
        const isDragging = dragIndex === index
        const isDropTarget = dropTarget === index

        const leftBg = getLeftBgUrl(spread)
        const rightBg = getRightBgUrl(spread)
        const hasFullSpread = !!spread.fullSpreadBackgroundMediaId && !!mediaUrls[spread.fullSpreadBackgroundMediaId]
        const hasBg = leftBg || rightBg

        return (
          <button
            key={spread.id}
            onClick={() => onSelect(index)}
            draggable={!isCover}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative group shrink-0 w-[120px] h-[68px] rounded overflow-hidden bg-zinc-800 flex transition-all ${
              isSelected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-zinc-600"
            } ${isDragging ? "opacity-40" : ""} ${
              isDropTarget ? "ring-2 ring-green-400" : ""
            } ${!isCover ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {/* Thumbnail preview */}
            {hasBg ? (
              hasFullSpread ? (
                <img
                  src={leftBg!}
                  alt={label}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex">
                  <div className="w-1/2 h-full bg-zinc-800 overflow-hidden">
                    {leftBg && (
                      <img src={leftBg} alt="" className="w-full h-full object-cover" draggable={false} />
                    )}
                  </div>
                  <div className="w-1/2 h-full bg-zinc-800 overflow-hidden">
                    {rightBg && (
                      <img src={rightBg} alt="" className="w-full h-full object-cover" draggable={false} />
                    )}
                  </div>
                </div>
              )
            ) : null}

            {/* Label overlay */}
            <span className={`relative z-10 text-[10px] px-1 text-center leading-tight w-full ${
              hasBg ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-zinc-400"
            }`}>
              {label}
            </span>

            {/* Delete button — hidden for cover */}
            {!isCover && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(index)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    onRemove(index)
                  }
                }}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-zinc-900/80 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        )
      })}

      {/* Add spread button */}
      <button
        onClick={onAdd}
        className="shrink-0 w-[48px] h-[68px] rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
        title="Add spread"
      >
        <Plus className="w-5 h-5 text-zinc-300" />
      </button>
    </div>
  )
}
