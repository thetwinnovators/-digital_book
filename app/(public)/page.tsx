"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookCard } from "@/components/book-card"
import { PasswordModal } from "@/components/password-modal"
import { getPublishedBooks, getBookById } from "@/lib/book-store"
import { getMediaUrl } from "@/lib/media-store"
import type { Book } from "@/lib/types"

export default function GalleryPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  useEffect(() => {
    let urls: string[] = []

    async function load() {
      try {
        const published = await getPublishedBooks()
        setBooks(published)

        const urlMap: Record<string, string> = {}
        await Promise.all(
          published.map(async (b) => {
            if (b.coverThumbnailMediaId) {
              const url = await getMediaUrl(b.coverThumbnailMediaId)
              if (url) {
                urlMap[b.id] = url
                urls.push(url)
              }
            }
          })
        )
        setCoverUrls(urlMap)
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      // Revoke all object URLs on unmount to avoid memory leaks
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  async function handleCardClick(book: Book) {
    const full = await getBookById(book.id)
    if (!full) return
    if (!full.passwordHash) {
      sessionStorage.setItem("unlocked:" + full.id, "true")
      router.push("/books/" + full.slug)
      return
    }
    setSelectedBook(full)
    setPasswordModalOpen(true)
  }

  function handleUnlocked(book: Book) {
    setPasswordModalOpen(false)
    router.push("/books/" + book.slug)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          <span className="text-sm">Loading books…</span>
        </div>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="text-center">
          <p className="text-zinc-400 text-sm">No books available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.map((b) => (
          <BookCard
            key={b.id}
            variant="public"
            title={b.title}
            coverUrl={coverUrls[b.id] ?? null}
            onClick={() => handleCardClick(b)}
          />
        ))}
      </div>

      <PasswordModal
        book={selectedBook}
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        onUnlocked={handleUnlocked}
      />
    </div>
  )
}
