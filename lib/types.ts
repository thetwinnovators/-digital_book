export interface BrochureIndex {
  id: string
  title: string
  slug: string
  status: "draft" | "published"
  updatedAt: string
}

export interface Brochure {
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
  elements: BrochureElement[]
}

export interface BrochureElement {
  id: string
  type: "text" | "image"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  content: TextContent | ImageContent
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

export interface SearchEntry {
  spreadIndex: number
  pageLabel: string
  plainText: string
}

export interface MediaRecord {
  id: string
  brochureId: string
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
