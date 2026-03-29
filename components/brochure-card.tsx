"use client"

import { BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface BrochureCardProps {
  title: string
  coverUrl: string | null
  variant: "public" | "admin"
  status?: "draft" | "published"
  pageCount?: number
  updatedAt?: string
  onClick?: () => void
  actions?: React.ReactNode
}

export function BrochureCard({
  title,
  coverUrl,
  variant,
  status,
  pageCount,
  updatedAt,
  onClick,
  actions,
}: BrochureCardProps) {
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null

  return (
    <div
      onClick={onClick}
      className="bg-zinc-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-zinc-500 hover:scale-[1.02] transition-all duration-200"
    >
      {/* Cover area — 16:9 aspect ratio */}
      <div className="relative w-full aspect-video">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${title} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-700">
            <BookOpen className="h-10 w-10 text-zinc-500" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug">
          {title}
        </p>

        {variant === "admin" && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {status && (
                <Badge
                  variant="outline"
                  className={
                    status === "published"
                      ? "border-green-600 text-green-400 text-xs"
                      : "border-yellow-600 text-yellow-400 text-xs"
                  }
                >
                  {status}
                </Badge>
              )}
              {pageCount !== undefined && (
                <span className="text-xs text-zinc-500">
                  {pageCount} {pageCount === 1 ? "page" : "pages"}
                </span>
              )}
            </div>
            {formattedDate && (
              <span className="text-xs text-zinc-500">{formattedDate}</span>
            )}
          </div>
        )}

        {variant === "admin" && actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pt-1"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
