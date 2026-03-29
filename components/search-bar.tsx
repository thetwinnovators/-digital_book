"use client"

import { useState, KeyboardEvent } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  initialQuery?: string
  onSubmit: (query: string) => void
}

export function SearchBar({ initialQuery = "", onSubmit }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      onSubmit(query)
    }
  }

  function handleClear() {
    setQuery("")
    onSubmit("")
  }

  return (
    <div className="relative flex items-center w-full">
      <Search className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search brochures..."
        className="pl-9 pr-8 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
