"use client"

import React from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import { PAGE_WIDTH, PAGE_HEIGHT } from "@/lib/constants"
import type { Spread, BrochureElement, TextContent, ImageContent } from "@/lib/types"

interface PageRendererProps {
  spread: Spread
  side: "left" | "right"
  mediaUrls: Record<string, string>
  className?: string
}

const PageRenderer = React.forwardRef<HTMLDivElement, PageRendererProps>(
  function PageRenderer({ spread, side, mediaUrls, className }, ref) {
    // Determine background
    let backgroundNode: React.ReactNode = null

    if (
      spread.fullSpreadBackgroundMediaId &&
      mediaUrls[spread.fullSpreadBackgroundMediaId]
    ) {
      // Full-spread background: render 1440px wide image, shift left half for right page
      const objectPosition = side === "left" ? "left" : "right"
      backgroundNode = (
        <img
          src={mediaUrls[spread.fullSpreadBackgroundMediaId]}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: side === "right" ? -PAGE_WIDTH : 0,
            width: PAGE_WIDTH * 2,
            height: "100%",
            objectFit: "cover",
            objectPosition,
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
    const filteredElements = spread.elements.filter((el: BrochureElement) => {
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
        className={`relative overflow-hidden bg-zinc-800${className ? ` ${className}` : ""}`}
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
      >
        {backgroundNode}

        {sortedElements.map((element: BrochureElement) => {
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

          return null
        })}
      </div>
    )
  }
)

PageRenderer.displayName = "PageRenderer"

export default PageRenderer
