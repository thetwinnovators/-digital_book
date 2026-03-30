"use client"

import { X } from "lucide-react"
import type { Spread } from "@/lib/types"

interface ThumbnailModalProps {
  spreads: Spread[]
  totalSteps: number
  currentStep: number
  mediaUrls: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectStep: (step: number) => void
}

export default function ThumbnailModal({
  spreads,
  totalSteps,
  currentStep,
  mediaUrls,
  open,
  onOpenChange,
  onSelectStep,
}: ThumbnailModalProps) {
  if (!open) return null

  function handleSelect(step: number) {
    onSelectStep(step)
    onOpenChange(false)
  }

  function getSpreadBgUrl(spread: Spread): string | undefined {
    const bgId = spread.fullSpreadBackgroundMediaId ?? spread.leftBackgroundMediaId ?? spread.rightBackgroundMediaId
    return bgId ? mediaUrls[bgId] : undefined
  }

  // Build thumbnail entries — all spread-width
  const entries: { step: number; label: string; leftBgUrl?: string; rightBgUrl?: string; isFullSpread?: boolean }[] = []

  // Cover: spread[0] shown as full spread (left + right)
  const coverSpread = spreads[0]
  const coverFullBgId = coverSpread?.fullSpreadBackgroundMediaId
  const coverLeftBgId = coverSpread?.leftBackgroundMediaId
  const coverRightBgId = coverSpread?.rightBackgroundMediaId
  entries.push({
    step: 0,
    label: "Cover",
    // If full spread bg, use same image for both halves
    leftBgUrl: coverFullBgId ? mediaUrls[coverFullBgId] : (coverLeftBgId ? mediaUrls[coverLeftBgId] : undefined),
    rightBgUrl: coverFullBgId ? mediaUrls[coverFullBgId] : (coverRightBgId ? mediaUrls[coverRightBgId] : undefined),
    isFullSpread: !!coverFullBgId,
  })

  // Inner spreads
  for (let step = 1; step < totalSteps; step++) {
    const spread = spreads[step]
    if (!spread) continue
    const leftPage = (step - 1) * 2 + 1
    const rightPage = (step - 1) * 2 + 2
    entries.push({
      step,
      label: `${leftPage}-${rightPage}`,
      leftBgUrl: getSpreadBgUrl(spread),
      rightBgUrl: undefined, // single bg covers both
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#d1d5db" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-600 flex-shrink-0">
        <h2 className="text-white text-sm font-semibold">All Pages</h2>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-500 text-white hover:bg-zinc-400 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thumbnail grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {entries.map((entry) => {
            const isActive = entry.step === currentStep

            return (
              <button
                key={entry.step}
                type="button"
                onClick={() => handleSelect(entry.step)}
                className={`rounded-lg overflow-hidden transition-all hover:scale-[1.03] focus:outline-none ${
                  isActive
                    ? "ring-3 ring-blue-500"
                    : ""
                }`}
              >
                {/* Thumbnail preview */}
                <div
                  className="w-full aspect-[16/9] bg-white relative flex"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                >
                  {entry.step === 0 ? (
                    entry.isFullSpread && entry.leftBgUrl ? (
                      // Full-spread cover: single image spanning both halves
                      <div
                        className="w-full h-full bg-zinc-700"
                        style={{
                          backgroundImage: `url(${entry.leftBgUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    ) : (
                      <>
                        {/* Cover: separate left + right backgrounds */}
                        <div
                          className="w-1/2 h-full bg-zinc-700"
                          style={
                            entry.leftBgUrl
                              ? {
                                  backgroundImage: `url(${entry.leftBgUrl})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "left center",
                                }
                              : undefined
                          }
                        />
                        <div
                          className="w-1/2 h-full bg-zinc-700"
                          style={
                            entry.rightBgUrl
                              ? {
                                  backgroundImage: `url(${entry.rightBgUrl})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "right center",
                                }
                              : undefined
                          }
                        />
                      </>
                    )
                  ) : (
                    <div
                      className="w-full h-full bg-gray-100"
                      style={
                        entry.leftBgUrl
                          ? {
                              backgroundImage: `url(${entry.leftBgUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    />
                  )}
                </div>

                {/* Label */}
                <div className="py-1.5 text-center">
                  <span className="text-xs text-gray-600 font-medium">{entry.label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
