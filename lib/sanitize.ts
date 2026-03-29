import DOMPurify from "dompurify"

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "span", "br", "p", "div"],
    ALLOWED_ATTR: ["style"],
  })
}
