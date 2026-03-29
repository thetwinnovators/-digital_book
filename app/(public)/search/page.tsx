"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { searchBrochures, type SearchResult } from "@/lib/search"
import { getAllBrochures } from "@/lib/brochure-store"
import { getMediaUrl } from "@/lib/media-store"

function highlightQuery(text: string, query: string) {
  if (!query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function parseFirstPage(pageLabel: string): number {
  const num = parseInt(pageLabel.split("-")[0], 10)
  return isNaN(num) ? 1 : num
}

interface ResultWithCover extends SearchResult {
  coverUrl: string | null
}

function SearchResultsContent() {
  const searchParams = useSearchParams()
  const q = searchParams.get("q") || ""
  const [results, setResults] = useState<ResultWithCover[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      const brochures = await getAllBrochures()
      const searchResults = searchBrochures(q, brochures)

      const withCovers = await Promise.all(
        searchResults.map(async (r) => {
          let coverUrl: string | null = null
          if (r.coverThumbnailMediaId) {
            coverUrl = await getMediaUrl(r.coverThumbnailMediaId)
          }
          return { ...r, coverUrl }
        })
      )

      if (!cancelled) {
        setResults(withCovers)
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [q])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-400 text-lg">Searching...</div>
      </div>
    )
  }

  if (!q.trim()) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-400 text-lg">Enter a search term to find brochures.</div>
      </div>
    )
  }

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">
        Results for &ldquo;{q}&rdquo; &mdash; {results.length} result{results.length !== 1 ? "s" : ""}
        {totalMatches > 0 && (
          <span className="text-zinc-400 text-base font-normal ml-2">
            ({totalMatches} page match{totalMatches !== 1 ? "es" : ""})
          </span>
        )}
      </h1>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">No results found. Try a different search term.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {results.map((result) => (
            <div
              key={result.brochureId}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex gap-4">
                {result.coverUrl ? (
                  <div className="flex-shrink-0 w-20 h-28 rounded overflow-hidden bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.coverUrl}
                      alt={result.brochureTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-20 h-28 rounded bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-600 text-xs">No cover</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/brochures/${result.brochureSlug}`}
                    className="text-lg font-bold text-zinc-100 hover:text-white transition-colors"
                  >
                    {result.brochureTitle}
                  </Link>

                  {result.matches.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {result.matches.map((match, idx) => {
                        const page = parseFirstPage(match.pageLabel)
                        return (
                          <div key={idx} className="text-sm">
                            <Link
                              href={`/brochures/${result.brochureSlug}?page=${page}`}
                              className="text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
                            >
                              Page {match.pageLabel}
                            </Link>
                            <p className="text-zinc-300 mt-0.5 leading-relaxed">
                              {highlightQuery(match.snippet, q)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400 text-lg">Loading...</div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  )
}
