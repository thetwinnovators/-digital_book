import { openDB, type IDBPDatabase } from "idb"

export interface BookHubDBSchema {
  brochures: {
    key: string
    value: import("./types").Book
    indexes: { "by-slug": string; "by-status": string }
  }
  media: {
    key: string
    value: import("./types").MediaRecord
    indexes: { "by-book": string }
  }
}

let dbPromise: Promise<IDBPDatabase<BookHubDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<BookHubDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BookHubDBSchema>("DigitalBookDB", 1, {
      upgrade(db) {
        const bookStore = db.createObjectStore("brochures", {
          keyPath: "id",
        })
        bookStore.createIndex("by-slug", "slug", { unique: true })
        bookStore.createIndex("by-status", "status")

        const mediaStore = db.createObjectStore("media", { keyPath: "id" })
        mediaStore.createIndex("by-book", "bookId")
      },
    })
  }
  return dbPromise
}
