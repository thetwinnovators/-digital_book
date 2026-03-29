"use client"

import { Plus, X } from "lucide-react"
import type { Spread } from "@/lib/types"

interface SpreadStripProps {
  spreads: Spread[]
  currentIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export default function SpreadStrip({
  spreads,
  currentIndex,
  onSelect,
  onAdd,
  onRemove,
}: SpreadStripProps) {
  return (
    <div className="h-24 overflow-x-auto flex gap-2 p-2 items-center">
      {spreads.map((spread, index) => {
        const isCover = index === 0
        const leftLabel = spread.leftPageLabel || (isCover ? "Cover" : String(index * 2 - 1))
        const rightLabel = spread.rightPageLabel || (isCover ? "" : String(index * 2))
        const label = isCover ? "Cover" : `Pages ${leftLabel}-${rightLabel}`
        const isSelected = index === currentIndex

        return (
          <button
            key={spread.id}
            onClick={() => onSelect(index)}
            className={`relative group shrink-0 w-[120px] h-[68px] rounded overflow-hidden bg-zinc-800 flex items-center justify-center transition-all ${
              isSelected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-zinc-600"
            }`}
          >
            <span className="text-[10px] text-zinc-400 px-1 text-center leading-tight">
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
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-zinc-900/80 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
