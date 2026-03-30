export interface BookIndex {
  id: string
  title: string
  slug: string
  status: "draft" | "published"
  updatedAt: string
}

export interface Book {
  id: string
  title: string
  slug: string
  description: string
  status: "draft" | "published"
  passwordHash: string
  coverThumbnailMediaId: string | null
  spreads: Spread[]
  searchText: SearchEntry[]
  createdAt: string
  updatedAt: string
}

export interface Spread {
  id: string
  spreadIndex: number
  leftPageLabel: string
  rightPageLabel: string
  leftBackgroundMediaId: string | null
  rightBackgroundMediaId: string | null
  fullSpreadBackgroundMediaId: string | null
  backgroundColor: string
  elements: BookElement[]
}

export interface BookElement {
  id: string
  type: "text" | "image" | "video" | "audio"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  content: TextContent | ImageContent | VideoContent | AudioContent
}

export interface TextContent {
  html: string
  fontFamily: string
  fontSize: number
  color: string
  fontWeight: string
  alignment: string
  lineHeight: number
  letterSpacing: number
  opacity: number
}

export interface ImageContent {
  mediaId: string
  objectFit: "cover" | "contain" | "fill"
}

export interface VideoContent {
  mediaId: string
  url: string
  autoplay: boolean
  loop: boolean
  muted: boolean
  thumbnailMediaId: string
  thumbnailUrl: string
  showCaptions: boolean
}

export interface AudioContent {
  mediaId: string
  url: string
  autoplay: boolean
  loop: boolean
}

export interface SearchEntry {
  spreadIndex: number
  pageLabel: string
  plainText: string
}

export interface MediaRecord {
  id: string
  bookId: string
  blob: Blob
  mimeType: string
  createdAt: string
}

export interface AdminSession {
  username: string
  loggedInAt: string
  expiresAt: string
}

export interface AdminCredentials {
  username: string
  passwordHash: string
}
