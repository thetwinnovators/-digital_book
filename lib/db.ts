import { openDB, type IDBPDatabase } from "idb"

export interface BrochureHubDBSchema {
  brochures: {
    key: string
    value: import("./types").Brochure
    indexes: { "by-slug": string; "by-status": string }
  }
  media: {
    key: string
    value: import("./types").MediaRecord
    indexes: { "by-brochure": string }
  }
}

let dbPromise: Promise<IDBPDatabase<BrochureHubDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<BrochureHubDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BrochureHubDBSchema>("BrochureHubDB", 1, {
      upgrade(db) {
        const brochureStore = db.createObjectStore("brochures", {
          keyPath: "id",
        })
        brochureStore.createIndex("by-slug", "slug", { unique: true })
        brochureStore.createIndex("by-status", "status")

        const mediaStore = db.createObjectStore("media", { keyPath: "id" })
        mediaStore.createIndex("by-brochure", "brochureId")
      },
    })
  }
  return dbPromise
}
