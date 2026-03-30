"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import { getAllBooks, saveBook, deleteBook } from "@/lib/book-store"
import { getMediaUrl } from "@/lib/media-store"
import { generateId, generatePageLabels } from "@/lib/utils"
import type { Book, Spread } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Pencil, Eye, Trash2, MoreVertical, ExternalLink } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)

  const loadBooks = useCallback(async () => {
    const all = await getAllBooks()
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    setBooks(all)

    const urls: Record<string, string> = {}
    for (const b of all) {
      // Try saved thumbnail, then backgrounds, then first image element on cover
      const coverSpread = b.spreads[0]
      const firstImageEl = coverSpread?.elements.find(
        (el) => el.type === "image" && (el.content as { mediaId: string }).mediaId
      )
      const mediaId =
        b.coverThumbnailMediaId ||
        coverSpread?.fullSpreadBackgroundMediaId ||
        coverSpread?.rightBackgroundMediaId ||
        coverSpread?.leftBackgroundMediaId ||
        (firstImageEl ? (firstImageEl.content as { mediaId: string }).mediaId : null) ||
        null
      if (mediaId) {
        const url = await getMediaUrl(mediaId)
        if (url) urls[b.id] = url
      }
    }
    setCoverUrls(urls)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/sign-in")
      return
    }
    loadBooks()
  }, [router, loadBooks])

  useEffect(() => {
    return () => {
      Object.values(coverUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [coverUrls])

  async function handleCreate() {
    const id = generateId()
    const slug = "untitled-project-" + id.slice(0, 8)
    const now = new Date().toISOString()

    const spreads: Spread[] = Array.from({ length: 6 }, (_, i) => {
      const labels = generatePageLabels(i)
      return {
        id: generateId(),
        spreadIndex: i,
        leftPageLabel: labels.left,
        rightPageLabel: labels.right,
        leftBackgroundMediaId: null,
        rightBackgroundMediaId: null,
        fullSpreadBackgroundMediaId: null,
        elements: [],
      }
    })

    const newBook: Book = {
      id,
      title: "Untitled Project",
      slug,
      description: "",
      status: "draft",
      passwordHash: "",
      coverThumbnailMediaId: null,
      spreads,
      searchText: [],
      createdAt: now,
      updatedAt: now,
    }

    await saveBook(newBook)
    router.push("/editor/" + id)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteBook(deleteTarget.id)
    setDeleteTarget(null)
    await loadBooks()
  }

  async function handleToggleStatus(book: Book) {
    const updated: Book = {
      ...book,
      status: book.status === "draft" ? "published" : "draft",
      updatedAt: new Date().toISOString(),
    }
    await saveBook(updated)
    setBooks((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    )
  }

  function handlePreview(book: Book) {
    router.push("/books/" + book.slug)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">My Books</h1>
        <Button onClick={handleCreate}>
          <Plus className="size-4 mr-2" />
          Create New Book
        </Button>
      </div>

      {/* Empty state */}
      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-zinc-400 mb-4">No books yet. Create your first book!</p>
          <Button onClick={handleCreate}>
            <Plus className="size-4 mr-2" />
            Create New Book
          </Button>
        </div>
      ) : (
        /* Book Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <div
              key={book.id}
              className="bg-zinc-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-zinc-500 transition-all"
              onClick={() => router.push("/editor/" + book.id)}
            >
              {/* Cover image area */}
              <div className="aspect-video bg-zinc-800 relative">
                {coverUrls[book.id] ? (
                  <img
                    src={coverUrls[book.id]}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                    No cover image
                  </div>
                )}
              </div>

              {/* Card content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-white font-semibold truncate">
                      {book.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={
                          book.status === "published"
                            ? "bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full"
                            : "bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full"
                        }
                      >
                        {book.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => router.push("/editor/" + book.id)}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleToggleStatus(book)}
                      >
                        <ExternalLink className="size-4" />
                        {book.status === "published" ? "Unpublish" : "Publish"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handlePreview(book)}
                      >
                        <Eye className="size-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget(book)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                  <span>{book.spreads.length * 2} pages</span>
                  <span>Updated {formatDate(book.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &apos;{deleteTarget?.title}&apos;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
