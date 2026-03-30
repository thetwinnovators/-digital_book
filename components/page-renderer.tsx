"use client"

import React from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import { PAGE_WIDTH, PAGE_HEIGHT } from "@/lib/constants"
import type { Spread, BookElement, TextContent, ImageContent, VideoContent, AudioContent } from "@/lib/types"
import AudioPlayer from "@/components/audio-player"
import VideoPlayer from "@/components/video-player"

interface PageRendererProps {
  spread: Spread
  side: "left" | "right"
  mediaUrls: Record<string, string>
  className?: string
  pageNumber?: number
}

const PageRenderer = React.forwardRef<HTMLDivElement, PageRendererProps>(
  function PageRenderer({ spread, side, mediaUrls, className, pageNumber }, ref) {
    // Odd pages get light grey background, even pages get dark
    const hasBackground =
      spread.fullSpreadBackgroundMediaId ||
      (side === "left" ? spread.leftBackgroundMediaId : spread.rightBackgroundMediaId)
    const defaultBg = !hasBackground && pageNumber !== undefined && pageNumber % 2 === 1
      ? "bg-gray-200"
      : "bg-zinc-800"

    // Determine background
    let backgroundNode: React.ReactNode = null

    if (
      spread.fullSpreadBackgroundMediaId &&
      mediaUrls[spread.fullSpreadBackgroundMediaId]
    ) {
      // Full-spread background: show the correct half using object-position
      backgroundNode = (
        <img
          src={mediaUrls[spread.fullSpreadBackgroundMediaId]}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: side === "left" ? "left center" : "right center",
          }}
        />
      )
    } else {
      const sideBackgroundMediaId =
        side === "left" ? spread.leftBackgroundMediaId : spread.rightBackgroundMediaId

      if (sideBackgroundMediaId && mediaUrls[sideBackgroundMediaId]) {
        backgroundNode = (
          <img
            src={mediaUrls[sideBackgroundMediaId]}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )
      }
    }

    // Filter elements to the current side
    const filteredElements = spread.elements.filter((el: BookElement) => {
      if (side === "left") {
        return el.x < PAGE_WIDTH
      } else {
        return el.x + el.width > PAGE_WIDTH
      }
    })

    // Sort by zIndex ascending so higher z renders on top
    const sortedElements = [...filteredElements].sort((a, b) => a.zIndex - b.zIndex)

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden ${spread.backgroundColor ? "" : defaultBg}${className ? ` ${className}` : ""}`}
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          backgroundColor: spread.backgroundColor || undefined,
        }}
      >
        {backgroundNode}

        {sortedElements.map((element: BookElement) => {
          // For right-side page the container represents canvas x=720–1440, so offset by -720
          const adjustedX = side === "right" ? element.x - PAGE_WIDTH : element.x

          const positionStyle: React.CSSProperties = {
            position: "absolute",
            left: adjustedX,
            top: element.y,
            width: element.width,
            height: element.height,
            ...(element.rotation !== 0
              ? { transform: `rotate(${element.rotation}deg)` }
              : {}),
          }

          if (element.type === "text") {
            const content = element.content as TextContent
            // Content has already been sanitized by DOMPurify via sanitizeHtml
            const sanitizedHtml = sanitizeHtml(content.html)
            const textStyle: React.CSSProperties = {
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
              overflowWrap: "break-word",
              wordWrap: "break-word",
              whiteSpace: "pre-wrap",
            }

            return (
              <div key={element.id} style={positionStyle}>
                {/* sanitizeHtml runs DOMPurify before this render — safe to use dangerouslySetInnerHTML */}
                <div
                  style={textStyle}
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              </div>
            )
          }

          if (element.type === "image") {
            const content = element.content as ImageContent
            const src = mediaUrls[content.mediaId]

            return (
              <div key={element.id} style={positionStyle}>
                {src && (
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: content.objectFit }}
                  />
                )}
              </div>
            )
          }

          if (element.type === "video") {
            const content = element.content as VideoContent
            const src = content.url || mediaUrls[content.mediaId] || null
            const poster = content.thumbnailUrl || (content.thumbnailMediaId ? mediaUrls[content.thumbnailMediaId] : undefined) || undefined

            return (
              <div key={element.id} style={positionStyle}>
                {src && (
                  <VideoPlayer
                    src={src}
                    autoPlay={content.autoplay}
                    muted={content.muted}
                    loop={content.loop}
                    poster={poster}
                  />
                )}
              </div>
            )
          }

          if (element.type === "audio") {
            const content = element.content as AudioContent
            const src = content.url || mediaUrls[content.mediaId] || null

            return (
              <div key={element.id} style={positionStyle}>
                {src && (
                  <AudioPlayer src={src} loop={content.loop} autoPlay={content.autoplay} />
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    )
  }
)

PageRenderer.displayName = "PageRenderer"

export default PageRenderer
