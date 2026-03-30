"use client"

import { useRef, useCallback, Suspense } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { User, LogOut } from "lucide-react"
import { SearchBar } from "@/components/search-bar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearSession } from "@/lib/auth"
import { searchBooks, type SearchResult } from "@/lib/search"
import { getPublishedBooks } from "@/lib/book-store"
import type { Book } from "@/lib/types"

function HeaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const bookCacheRef = useRef<Book[] | null>(null)
  const loadingRef = useRef(false)

  // Determine variant from pathname
  const isAdmin = pathname.startsWith("/dashboard") || pathname.startsWith("/editor")
  const isReader = pathname.startsWith("/books/")

  const initialQuery = searchParams.get("q") || ""

  function handleSearch(query: string) {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push("/")
    }
  }

  function handleSignOut() {
    clearSession()
    router.push("/")
  }

  const getSuggestions = useCallback((query: string): SearchResult[] => {
    if (!bookCacheRef.current) {
      if (!loadingRef.current) {
        loadingRef.current = true
        getPublishedBooks().then((data) => {
          bookCacheRef.current = data
          loadingRef.current = false
        })
      }
      return []
    }
    return searchBooks(query, bookCacheRef.current)
  }, [])

  // Reader mode: return null for immersive experience (after all hooks)
  if (isReader) return null

  return (
    <header className="border-b border-zinc-800 h-16 flex items-center px-4 md:px-8 gap-4" style={{ backgroundColor: "#006e74" }}>
      {/* Logo */}
      <Link
        href="/"
        className="text-lg font-bold text-zinc-100 whitespace-nowrap hover:text-white transition-colors flex-shrink-0"
      >
        Digital Book
      </Link>

      {/* Search bar - center */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-md">
          <SearchBar
            initialQuery={initialQuery}
            onSubmit={handleSearch}
            getSuggestions={getSuggestions}
          />
        </div>
      </div>

      {/* Right side */}
      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-center h-9 w-9 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors flex-shrink-0"
            aria-label="User menu"
          >
            <User className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link href="/sign-in" className="flex-shrink-0">
          <Button
            variant="ghost"
            className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
          >
            Sign In
          </Button>
        </Link>
      )}
    </header>
  )
}

export function Header() {
  return (
    <Suspense fallback={null}>
      <HeaderInner />
    </Suspense>
  )
}
