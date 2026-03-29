"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Spread } from "@/lib/types"

interface ThumbnailModalProps {
  spreads: Spread[]
  currentSpreadIndex: number
  mediaUrls: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectSpread: (spreadIndex: number) => void
}

export default function ThumbnailModal({
  spreads,
  currentSpreadIndex,
  mediaUrls,
  open,
  onOpenChange,
  onSelectSpread,
}: ThumbnailModalProps) {
  function handleSelect(spreadIndex: number) {
    onSelectSpread(spreadIndex)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-white">All Pages</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {spreads.map((spread, idx) => {
            const isActive = idx === currentSpreadIndex

            // Build label
            let label: string
            if (idx === 0) {
              label = "Cover"
            } else {
              const leftNum = idx * 2
              const rightNum = idx * 2 + 1
              label = `Pages ${leftNum}-${rightNum}`
            }

            // Determine thumbnail background
            const bgMediaId =
              spread.fullSpreadBackgroundMediaId ??
              spread.leftBackgroundMediaId ??
              spread.rightBackgroundMediaId
            const bgUrl = bgMediaId ? mediaUrls[bgMediaId] : undefined

            return (
              <button
                key={spread.id}
                type="button"
                onClick={() => handleSelect(idx)}
                className={`rounded-lg overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? "ring-2 ring-blue-500 border-blue-500"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div
                  className="aspect-[16/9] bg-zinc-800 relative"
                  style={
                    bgUrl
                      ? {
                          backgroundImage: `url(${bgUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                />
                <div className="px-2 py-1.5 bg-zinc-800 text-center">
                  <span className="text-xs text-zinc-300">{label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
