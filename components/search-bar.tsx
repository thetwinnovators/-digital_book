"use client"

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react"
import { Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants"
import type { SearchResult } from "@/lib/search"

interface SearchBarProps {
  initialQuery?: string
  onSubmit: (query: string) => void
  getSuggestions?: (query: string) => SearchResult[]
}

export function SearchBar({ initialQuery = "", onSubmit, getSuggestions }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Sync initialQuery when it changes externally
  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const updateSuggestions = useCallback(
    (value: string) => {
      if (!getSuggestions || !value.trim()) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      const results = getSuggestions(value)
      setSuggestions(results.slice(0, 5))
      setHighlightedIndex(-1)
      setShowSuggestions(results.length > 0)
    },
    [getSuggestions]
  )

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSuggestions(value)
    }, SEARCH_DEBOUNCE_MS)
  }

  function navigateToSuggestion(result: SearchResult) {
    const firstMatch = result.matches[0]
    let page = 1
    if (firstMatch) {
      const parsed = parseInt(firstMatch.pageLabel.split("-")[0], 10)
      if (!isNaN(parsed)) page = parsed
    }
    setShowSuggestions(false)
    router.push(`/books/${result.bookSlug}?page=${page}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        return
      }
      if (e.key === "Escape") {
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        return
      }
      if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault()
          navigateToSuggestion(suggestions[highlightedIndex])
          return
        }
      }
    }
    if (e.key === "Enter") {
      setShowSuggestions(false)
      onSubmit(query)
    }
  }

  function handleClear() {
    setQuery("")
    setSuggestions([])
    setShowSuggestions(false)
    onSubmit("")
  }

  function truncate(text: string, max: number) {
    return text.length > max ? text.slice(0, max) + "..." : text
  }

  return (
    <div ref={containerRef} className="relative flex items-center w-full">
      <Search className="absolute left-3 h-4 w-4 text-white/70 pointer-events-none" />
      <Input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true)
        }}
        placeholder="Search books..."
        className="pl-9 pr-8 bg-white/15 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-2 p-1 text-white/60 hover:text-white transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {suggestions.map((result, index) => {
            const firstMatch = result.matches[0]
            return (
              <button
                key={result.bookId}
                onMouseDown={(e) => {
                  e.preventDefault()
                  navigateToSuggestion(result)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3 py-2 ${
                  index === highlightedIndex ? "bg-zinc-800" : ""
                } hover:bg-zinc-800 transition-colors`}
              >
                <div className="font-bold text-zinc-100 text-sm">
                  {result.bookTitle}
                </div>
                {firstMatch && (
                  <div className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-zinc-500">p. {firstMatch.pageLabel}</span>
                    {" — "}
                    {truncate(firstMatch.snippet, 60)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
