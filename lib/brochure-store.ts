import { getDB } from "@/lib/db"
import type { Brochure, BrochureIndex } from "@/lib/types"
import { deleteMediaByBrochure } from "@/lib/media-store"

export async function getAllBrochures(): Promise<Brochure[]> {
  const db = await getDB()
  return db.getAll("brochures")
}

export async function getPublishedBrochures(): Promise<Brochure[]> {
  const db = await getDB()
  return db.getAllFromIndex("brochures", "by-status", "published")
}

export async function getBrochureById(id: string): Promise<Brochure | undefined> {
  const db = await getDB()
  return db.get("brochures", id)
}

export async function getBrochureBySlug(slug: string): Promise<Brochure | undefined> {
  const db = await getDB()
  return db.getFromIndex("brochures", "by-slug", slug)
}

export async function saveBrochure(brochure: Brochure): Promise<void> {
  const db = await getDB()
  await db.put("brochures", brochure)
  await syncIndex()
}

export async function deleteBrochure(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("brochures", id)
  await deleteMediaByBrochure(id)
  await syncIndex()
}

export async function syncIndex(): Promise<void> {
  const brochures = await getAllBrochures()
  const index: BrochureIndex[] = brochures.map((b) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    status: b.status,
    updatedAt: b.updatedAt,
  }))
  localStorage.setItem("brochure_index", JSON.stringify(index))
}

export function getIndex(): BrochureIndex[] {
  return JSON.parse(localStorage.getItem("brochure_index") || "[]")
}
