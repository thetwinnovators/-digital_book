"use client"

import {
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Lock,
  Trash2,
  Type,
  Unlock,
} from "lucide-react"
import type { BrochureElement, TextContent } from "@/lib/types"

interface LayerPanelProps {
  elements: BrochureElement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (elementId: string, direction: "up" | "down") => void
  onToggleLock: (id: string) => void
  onDelete: (id: string) => void
}

function getLabel(el: BrochureElement): string {
  if (el.type === "text") {
    const plain = (el.content as TextContent).html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (!plain) return "Text"
    return plain.length > 20 ? plain.slice(0, 20) + "\u2026" : plain
  }
  return "Image"
}

export default function LayerPanel({
  elements,
  selectedId,
  onSelect,
  onReorder,
  onToggleLock,
  onDelete,
}: LayerPanelProps) {
  // Sort by zIndex descending so highest layer appears at top
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex)

  return (
    <div className="flex flex-col gap-1">
      {sorted.length === 0 && (
        <p className="text-xs text-zinc-600 mt-2">No elements yet</p>
      )}
      {sorted.map((el) => {
        const isSelected = el.id === selectedId
        return (
          <div
            key={el.id}
            onClick={() => onSelect(el.id)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
              isSelected
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50"
            }`}
          >
            {/* Type icon */}
            {el.type === "text" ? (
              <Type className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            )}

            {/* Label */}
            <span className="truncate flex-1 min-w-0">{getLabel(el)}</span>

            {/* Reorder buttons */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReorder(el.id, "up")
              }}
              className="p-0.5 hover:text-zinc-100 transition-colors"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReorder(el.id, "down")
              }}
              className="p-0.5 hover:text-zinc-100 transition-colors"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Lock toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleLock(el.id)
              }}
              className="p-0.5 hover:text-zinc-100 transition-colors"
              title={el.locked ? "Unlock" : "Lock"}
            >
              {el.locked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </button>

            {/* Delete (hidden if locked) */}
            {!el.locked && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(el.id)
                }}
                className="p-0.5 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
