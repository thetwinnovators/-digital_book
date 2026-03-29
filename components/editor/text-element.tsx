"use client"

import { useCallback, useEffect, useRef } from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import type { TextContent } from "@/lib/types"

interface TextElementProps {
  content: TextContent
  selected: boolean
  onContentChange: (content: TextContent) => void
}

export default function TextElement({ content, selected, onContentChange }: TextElementProps) {
  const divRef = useRef<HTMLDivElement>(null)

  // Sync innerHTML when not focused (external updates or initial mount)
  // All HTML is sanitized with DOMPurify via sanitizeHtml() before rendering
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    if (document.activeElement === el) return
    const sanitized = sanitizeHtml(content.html)
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized
    }
  }, [content.html, selected])

  const handleInput = useCallback(() => {
    const el = divRef.current
    if (!el) return
    const sanitized = sanitizeHtml(el.innerHTML)
    onContentChange({ ...content, html: sanitized })
  }, [content, onContentChange])

  return (
    <div
      ref={divRef}
      contentEditable={selected}
      suppressContentEditableWarning
      onInput={handleInput}
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
        outline: "none",
        cursor: selected ? "text" : "default",
      }}
    />
  )
}
