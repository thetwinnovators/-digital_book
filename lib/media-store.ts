import { getDB } from "@/lib/db"
import type { MediaRecord } from "@/lib/types"
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/constants"

export async function saveMedia(record: MediaRecord): Promise<void> {
  const db = await getDB()
  await db.put("media", record)
}

export async function getMedia(id: string): Promise<MediaRecord | undefined> {
  const db = await getDB()
  return db.get("media", id)
}

export async function getMediaUrl(id: string): Promise<string | null> {
  const record = await getMedia(id)
  if (!record) return null
  return URL.createObjectURL(record.blob)
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("media", id)
}

export async function deleteMediaByBook(bookId: string): Promise<void> {
  const db = await getDB()
  const records = await db.getAllFromIndex("media", "by-book", bookId)
  for (const record of records) {
    await db.delete("media", record.id)
  }
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be an image." }
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size must not exceed ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`,
    }
  }
  return { valid: true }
}
