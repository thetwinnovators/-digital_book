import { getDB } from "@/lib/db"
import type { Book, BookIndex } from "@/lib/types"
import { deleteMediaByBook } from "@/lib/media-store"

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB()
  return db.getAll("brochures")
}

export async function getPublishedBooks(): Promise<Book[]> {
  const db = await getDB()
  return db.getAllFromIndex("brochures", "by-status", "published")
}

export async function getBookById(id: string): Promise<Book | undefined> {
  const db = await getDB()
  return db.get("brochures", id)
}

export async function getBookBySlug(slug: string): Promise<Book | undefined> {
  const db = await getDB()
  return db.getFromIndex("brochures", "by-slug", slug)
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDB()
  await db.put("brochures", book)
  await syncIndex()
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("brochures", id)
  await deleteMediaByBook(id)
  await syncIndex()
}

export async function syncIndex(): Promise<void> {
  const books = await getAllBooks()
  const index: BookIndex[] = books.map((b) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    status: b.status,
    updatedAt: b.updatedAt,
  }))
  localStorage.setItem("book_index", JSON.stringify(index))
}

export function getIndex(): BookIndex[] {
  return JSON.parse(localStorage.getItem("book_index") || "[]")
}
