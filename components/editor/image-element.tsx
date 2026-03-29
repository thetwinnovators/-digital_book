"use client"

import { ImageIcon } from "lucide-react"
import type { ImageContent } from "@/lib/types"

interface ImageElementProps {
  content: ImageContent
  mediaUrl: string | null
}

export default function ImageElement({ content, mediaUrl }: ImageElementProps) {
  if (mediaUrl) {
    return (
      <img
        src={mediaUrl}
        style={{ objectFit: content.objectFit }}
        className="w-full h-full"
        alt=""
        draggable={false}
      />
    )
  }

  return (
    <div className="w-full h-full bg-zinc-700 flex flex-col items-center justify-center text-zinc-400 gap-1">
      <ImageIcon className="w-6 h-6" />
      <span className="text-xs">No image</span>
    </div>
  )
}
