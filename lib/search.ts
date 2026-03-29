import type { Brochure, SearchEntry, TextContent } from "./types"

export interface SearchMatch {
  spreadIndex: number
  pageLabel: string
  snippet: string
}

export interface SearchResult {
  brochureId: string
  brochureTitle: string
  brochureSlug: string
  coverThumbnailMediaId: string | null
  matches: SearchMatch[]
  score: number
}

export function extractSearchText(brochure: Brochure): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const spread of brochure.spreads) {
    const texts: string[] = []
    for (const el of spread.elements) {
      if (el.type === "text") {
        const plain = (el.content as TextContent).html
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        if (plain) texts.push(plain)
      }
    }
    if (texts.length > 0) {
      entries.push({
        spreadIndex: spread.spreadIndex,
        pageLabel: spread.leftPageLabel + "-" + spread.rightPageLabel,
        plainText: texts.join(" "),
      })
    }
  }
  return entries
}

export function searchBrochures(query: string, brochures: Brochure[]): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const brochure of brochures) {
    if (brochure.status !== "published") continue
    const matches: SearchMatch[] = []
    let score = 0

    if (brochure.title.toLowerCase().includes(q)) score += 10
    if (brochure.description.toLowerCase().includes(q)) score += 5

    for (const entry of brochure.searchText) {
      const idx = entry.plainText.toLowerCase().indexOf(q)
      if (idx !== -1) {
        score += 1
        const start = Math.max(0, idx - 50)
        const end = Math.min(entry.plainText.length, idx + q.length + 50)
        const snippet =
          (start > 0 ? "..." : "") +
          entry.plainText.slice(start, end) +
          (end < entry.plainText.length ? "..." : "")
        matches.push({
          spreadIndex: entry.spreadIndex,
          pageLabel: entry.pageLabel,
          snippet,
        })
      }
    }

    if (score > 0) {
      results.push({
        brochureId: brochure.id,
        brochureTitle: brochure.title,
        brochureSlug: brochure.slug,
        coverThumbnailMediaId: brochure.coverThumbnailMediaId,
        matches,
        score,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
