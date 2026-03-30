# Digital Brochure Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a digital brochure hub with public gallery, password-protected 3D page-flip reader, admin dashboard, and WYSIWYG spread editor — all client-side with localStorage/IndexedDB.

**Architecture:** Next.js 16 App Router with route groups `(public)` and `(admin)`. Data stored in IndexedDB (brochures + media blobs) with a lightweight localStorage index. DOM-based editor shares `page-renderer` with the reader. `react-pageflip` for realistic 3D page turns.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, shadcn/ui, react-pageflip, idb, dompurify, Web Crypto API

**Spec:** `docs/superpowers/specs/2026-03-29-digital-brochure-hub-design.md`

**Security note:** All user-generated HTML (from contenteditable text elements) MUST be sanitized with DOMPurify before rendering. Never use `dangerouslySetInnerHTML` without sanitization.

---

## File Map

```
app/
├── layout.tsx                          # Root layout: dark theme, font, metadata
├── globals.css                         # Tailwind base + dark theme variables
├── (public)/
│   ├── page.tsx                        # Gallery homepage
│   ├── search/page.tsx                 # Search results page
│   └── brochures/[slug]/page.tsx       # Reader (password gate + book viewer)
├── (admin)/
│   ├── sign-in/page.tsx                # Admin login / first-time setup
│   ├── dashboard/page.tsx              # Brochure management grid
│   └── editor/[id]/page.tsx            # Spread editor

components/
├── ui/                                 # shadcn/ui primitives (Button, Dialog, Input, Card, etc.)
├── header.tsx                          # Global header (logo, search, auth)
├── search-bar.tsx                      # Search input + suggestions dropdown
├── brochure-card.tsx                   # Gallery/dashboard brochure card
├── password-modal.tsx                  # Brochure password gate
├── book-reader.tsx                     # react-pageflip wrapper + scaling
├── page-renderer.tsx                   # Single page renderer (shared reader/editor)
├── navigation-overlay.tsx              # Reader nav controls
├── thumbnail-modal.tsx                 # View All spreads grid
└── editor/
    ├── editor-canvas.tsx               # Spread editing surface
    ├── element-wrapper.tsx             # Drag/resize/select per element
    ├── text-element.tsx                # Contenteditable text block
    ├── image-element.tsx               # Image with object-fit
    ├── toolbar.tsx                     # Text formatting floating toolbar
    ├── layer-panel.tsx                 # Z-order list sidebar
    ├── spread-strip.tsx                # Bottom spread thumbnail strip
    └── history.ts                      # Undo/redo command stack

lib/
├── types.ts                            # All TypeScript interfaces
├── db.ts                               # IndexedDB init (idb wrapper)
├── brochure-store.ts                   # Brochure CRUD + localStorage index sync
├── media-store.ts                      # Media blob CRUD + object URL lifecycle
├── search.ts                           # Search indexing + querying
├── auth.ts                             # Admin auth (credentials + session)
├── utils.ts                            # Shared helpers (generateId, slugify, hashPassword)
├── sanitize.ts                         # DOMPurify wrapper for HTML sanitization
└── constants.ts                        # Magic numbers (canvas size, grid size, etc.)
```

---

## Task 1: Project Scaffold & Dependencies

**Files:**
- Create: `package.json`, `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `next.config.ts`, `lib/constants.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/Users/JenoU/Desktop/Digital_Book
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
```

Select defaults when prompted. This creates the Next.js 16 scaffold with Tailwind.

- [ ] **Step 2: Install dependencies**

```bash
npm install react-pageflip idb dompurify
npm install -D @types/dompurify
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables: yes.

- [ ] **Step 4: Add shadcn/ui components**

```bash
npx shadcn@latest add button dialog input card dropdown-menu tooltip alert-dialog badge separator scroll-area sheet
```

- [ ] **Step 5: Create constants file**

Create `lib/constants.ts`:

```typescript
export const CANVAS_WIDTH = 1440
export const CANVAS_HEIGHT = 812
export const PAGE_WIDTH = 720
export const PAGE_HEIGHT = 812
export const GRID_SIZE = 20
export const AUTOSAVE_INTERVAL_MS = 30_000
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const SEARCH_DEBOUNCE_MS = 300
export const NAV_OVERLAY_TIMEOUT_MS = 3000
export const DEFAULT_SPREADS_COUNT = 5
export const THUMBNAIL_COLUMNS_DESKTOP = 5
export const THUMBNAIL_COLUMNS_TABLET = 2
export const THUMBNAIL_COLUMNS_MOBILE = 1
```

- [ ] **Step 6: Create HTML sanitization wrapper**

Create `lib/sanitize.ts`:

```typescript
import DOMPurify from "dompurify"

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "span", "br", "p", "div"],
    ALLOWED_ATTR: ["style"],
  })
}
```

- [ ] **Step 7: Configure dark theme in globals.css**

Replace `app/globals.css` with Tailwind base + dark theme as default. Set `<html class="dark">` in layout.

- [ ] **Step 8: Set up root layout**

Create `app/layout.tsx` with dark theme, Geist Sans/Mono fonts, metadata, and `<html lang="en" className="dark">`.

- [ ] **Step 9: Verify dev server runs**

```bash
npm run dev
```

Confirm the app loads at `http://localhost:3000` with dark background.

- [ ] **Step 10: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 16 project with Tailwind, shadcn/ui, and dependencies"
```

---

## Task 2: TypeScript Types & Utilities

**Files:**
- Create: `lib/types.ts`, `lib/utils.ts`

- [ ] **Step 1: Create type definitions**

Create `lib/types.ts` with all interfaces from the spec:

```typescript
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
```

- [ ] **Step 2: Create utility helpers**

Create `lib/utils.ts` (extend the shadcn-generated file if it exists):

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function generatePageLabels(spreadIndex: number): {
  left: string
  right: string
} {
  if (spreadIndex === 0) {
    return { left: "Cover Left", right: "Cover Right" }
  }
  return {
    left: String(spreadIndex * 2 - 1),
    right: String(spreadIndex * 2),
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/utils.ts
git commit -m "feat: add TypeScript type definitions and utility helpers"
```

---

## Task 3: Storage Layer — IndexedDB + localStorage

**Files:**
- Create: `lib/db.ts`, `lib/brochure-store.ts`, `lib/media-store.ts`

- [ ] **Step 1: Create IndexedDB initialization**

Create `lib/db.ts`:

```typescript
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
```

- [ ] **Step 2: Create brochure store**

Create `lib/brochure-store.ts` with these functions:
- `getAllBrochures()` — returns all from IndexedDB
- `getPublishedBrochures()` — uses `by-status` index to get published only
- `getBrochureById(id)` — single get by key
- `getBrochureBySlug(slug)` — uses `by-slug` index
- `saveBrochure(brochure)` — `put` to IndexedDB brochures store + call `syncIndex()`
- `deleteBrochure(id)` — `delete` from IndexedDB + `deleteMediaByBrochure(id)` + `syncIndex()`
- `syncIndex()` — read all brochures, map to `BrochureIndex[]` (id, title, slug, status, updatedAt), write to `localStorage.setItem("brochure_index", JSON.stringify(index))`
- `getIndex()` — `JSON.parse(localStorage.getItem("brochure_index") || "[]")` for fast gallery reads

- [ ] **Step 3: Create media store**

Create `lib/media-store.ts` with:
- `saveMedia(record: MediaRecord)` — `put` to IndexedDB media store
- `getMedia(id: string)` — `get` by key, returns `MediaRecord | undefined`
- `getMediaUrl(id: string)` — get blob, return `URL.createObjectURL(blob)` (caller must revoke)
- `deleteMedia(id: string)` — `delete` from IndexedDB
- `deleteMediaByBrochure(brochureId: string)` — get all via `by-brochure` index, delete each
- `validateImageFile(file: File)` — returns `{ valid: boolean, error?: string }`, checks `file.type.startsWith("image/")` and `file.size <= MAX_IMAGE_SIZE_BYTES`

- [ ] **Step 4: Verify storage works**

Temporarily add a test button to the homepage that creates a brochure, saves it, reads it back, and logs to console. Confirm data persists across page reloads.

- [ ] **Step 5: Remove test code and commit**

```bash
git add lib/db.ts lib/brochure-store.ts lib/media-store.ts
git commit -m "feat: add IndexedDB storage layer for brochures and media"
```

---

## Task 4: Auth System

**Files:**
- Create: `lib/auth.ts`, `app/(admin)/sign-in/page.tsx`

- [ ] **Step 1: Create auth module**

Create `lib/auth.ts`:
- `hasCredentials(): boolean` — checks if `admin_creds` exists in localStorage
- `createCredentials(username: string, password: string): Promise<void>` — hash password, save `{ username, passwordHash }` to localStorage key `admin_creds`
- `validateCredentials(username: string, password: string): Promise<boolean>` — hash input, compare against stored hash and username
- `createSession(username: string): void` — save `{ username, loggedInAt: new Date().toISOString(), expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString() }` to localStorage key `admin_session`
- `getSession(): AdminSession | null` — read session, return null if missing or if `new Date(expiresAt) < new Date()`
- `clearSession(): void` — `localStorage.removeItem("admin_session")`
- `isAuthenticated(): boolean` — `getSession() !== null`

- [ ] **Step 2: Create sign-in page**

Create `app/(admin)/sign-in/page.tsx`:
- `"use client"` directive
- If `hasCredentials()` is false: show "Create Admin Account" form (username + password + confirm password)
- If `hasCredentials()` is true: show "Sign In" form (username + password)
- On submit: validate, create session, `router.push("/dashboard")`
- On error: show inline error below form, preserve username
- Style: centered card on dark background, shadcn/ui Input + Button components

- [ ] **Step 3: Test the flow**

- Visit `/sign-in` → "Create Admin Account" form
- Create credentials → redirects to `/dashboard` (404 OK)
- Clear `admin_session` in dev tools → revisit `/sign-in` → "Sign In" form
- Correct password → redirects
- Wrong password → inline error

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts "app/(admin)/sign-in/page.tsx"
git commit -m "feat: add admin auth system with sign-in page"
```

---

## Task 5: Global Header

**Files:**
- Create: `components/header.tsx`, `components/search-bar.tsx`

- [ ] **Step 1: Create search bar component**

Create `components/search-bar.tsx`:
- `"use client"` directive
- Props: `initialQuery?: string`, `onSubmit: (query: string) => void`
- shadcn/ui Input with search icon (magnifying glass) on left, clear "x" button on right (visible when query is non-empty)
- Controlled input with local state
- On Enter keydown: call `onSubmit(query)`
- Clear button: reset input, call `onSubmit("")`
- Suggestions dropdown is added in Task 12

- [ ] **Step 2: Create header component**

Create `components/header.tsx`:
- `"use client"` directive
- Props: `variant?: "public" | "admin" | "reader"`
- Auto-detect from `usePathname()` if no prop: paths starting with `/dashboard` or `/editor` = admin, `/brochures/` = reader, else public
- **Public:** logo (text "BrochureHub") left | SearchBar center | "Sign In" link right (navigates to `/sign-in`)
- **Admin:** logo left | SearchBar center | DropdownMenu right with username + "Sign Out" action (calls `clearSession()`, navigates to `/`)
- **Reader:** return `null` (hidden for immersive mode)
- Style: dark background (`bg-zinc-950`), subtle bottom border, `h-16`, items centered vertically, responsive padding

- [ ] **Step 3: Add header to root layout**

In `app/layout.tsx`:
- Import and render `<Header />` above `{children}`
- Main content area takes remaining height with `flex-1`

- [ ] **Step 4: Test**

- Visit `/` → public header with logo, search, Sign In
- Visit `/sign-in` → public header
- Sign in → visit `/dashboard` → admin header with Sign Out
- Click Sign Out → redirects to gallery, session cleared

- [ ] **Step 5: Commit**

```bash
git add components/header.tsx components/search-bar.tsx app/layout.tsx
git commit -m "feat: add global header with search bar and auth-aware navigation"
```

---

## Task 6: Public Gallery

**Files:**
- Create: `components/brochure-card.tsx`, `app/(public)/page.tsx`

- [ ] **Step 1: Create brochure card component**

Create `components/brochure-card.tsx`:
- Props: `title: string`, `coverUrl: string | null`, `variant: "public" | "admin"`, `status?: "draft" | "published"`, `pageCount?: number`, `updatedAt?: string`, `onClick?: () => void`, `actions?: ReactNode` (for admin dropdown)
- Public variant: cover thumbnail (or gradient placeholder with book icon), title below
- Admin variant: adds status badge, page count, updated date, actions slot
- Hover effect: `hover:ring-2 hover:ring-zinc-500 hover:scale-[1.02]` transition
- Dark card background (`bg-zinc-900`), rounded-lg, overflow-hidden
- Cover area: aspect ratio ~1440/812 (roughly 16:9)

- [ ] **Step 2: Create gallery page**

Create `app/(public)/page.tsx`:
- `"use client"` directive
- On mount: `getPublishedBrochures()` from IndexedDB
- For each brochure: resolve `coverThumbnailMediaId` to object URL via `getMediaUrl()`. Store in a `Record<string, string>` state, revoke all on unmount.
- Render responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
- Each card: `<BrochureCard variant="public" onClick={() => handleCardClick(brochure)} />`
- Empty state: centered text "No brochures available" with muted styling
- Loading state: skeleton cards while IndexedDB loads

- [ ] **Step 3: Wire card click to password modal (placeholder)**

On card click: store selected brochure in state. Password modal integration happens in Task 7. For now, just log the selection.

- [ ] **Step 4: Commit**

```bash
git add components/brochure-card.tsx "app/(public)/page.tsx"
git commit -m "feat: add public brochure gallery with responsive card grid"
```

---

## Task 7: Password Gate

**Files:**
- Create: `components/password-modal.tsx`
- Modify: `app/(public)/page.tsx`, `tailwind.config.ts`

- [ ] **Step 1: Add shake keyframe to Tailwind config**

In `tailwind.config.ts`, add to `theme.extend`:

```typescript
keyframes: {
  shake: {
    "0%, 100%": { transform: "translateX(0)" },
    "25%": { transform: "translateX(-8px)" },
    "75%": { transform: "translateX(8px)" },
  },
},
animation: {
  shake: "shake 0.3s ease-in-out",
},
```

- [ ] **Step 2: Create password modal**

Create `components/password-modal.tsx`:
- Props: `brochure: Brochure | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onUnlocked: (brochure: Brochure) => void`
- Uses shadcn/ui Dialog
- Content: brochure title as header, password Input (type="password"), Submit button
- On submit: `await hashPassword(input)`, compare to `brochure.passwordHash`
- Correct: `sessionStorage.setItem("unlocked:" + brochure.id, "true")`, call `onUnlocked(brochure)`
- Wrong: add `animate-shake` class to input temporarily (remove after 300ms), show "Incorrect password" text in red below input
- Close: calls `onOpenChange(false)`

- [ ] **Step 3: Wire into gallery page**

Modify `app/(public)/page.tsx`:
- State: `selectedBrochure: Brochure | null`, `passwordModalOpen: boolean`
- On card click: load full brochure from IndexedDB via `getBrochureById()`, set state, open modal
- `onUnlocked`: `router.push("/brochures/" + brochure.slug)`

- [ ] **Step 4: Test**

- Click card → modal opens with brochure title
- Wrong password → shake + error text
- Correct password → navigates to `/brochures/{slug}` (404 OK for now)
- Close modal → returns to gallery

- [ ] **Step 5: Commit**

```bash
git add components/password-modal.tsx "app/(public)/page.tsx" tailwind.config.ts
git commit -m "feat: add password gate modal with SHA-256 validation"
```

---

## Task 8: Page Renderer (Shared Component)

**Files:**
- Create: `components/page-renderer.tsx`

- [ ] **Step 1: Create page renderer**

Create `components/page-renderer.tsx`:
- Props: `spread: Spread`, `side: "left" | "right"`, `mediaUrls: Record<string, string>`, `className?: string`
- Uses `React.forwardRef` (required by react-pageflip for page children)
- Renders a 720x812 container with `relative overflow-hidden` and dark background (`bg-zinc-800`)
- **Background resolution:**
  - If `fullSpreadBackgroundMediaId`: render as full-width image, clip to left/right half using `object-position`
  - Else if side-specific background: render as `object-cover` filling the page
- **Element rendering:**
  - Filter elements to current side: left side = elements whose bounding box intersects `[0, 720)` (i.e., `x < 720`), right side = elements whose bounding box intersects `[720, 1440]` (i.e., `x + width > 720`). Elements spanning both sides render on both pages, clipped to their respective halves. Right-side elements are offset by -720 for positioning within the right page container.
  - For each element, render absolutely positioned at `{ left: adjustedX, top: y, width, height }`
  - Text elements: `<div>` with all style props applied, innerHTML set via `sanitizeHtml(content.html)` from `lib/sanitize.ts` — NEVER use unsanitized HTML
  - Image elements: `<img src={mediaUrls[content.mediaId]}` with `object-fit` from content
  - Apply `rotation` via CSS transform, `opacity` for text elements

- [ ] **Step 2: Test with hardcoded spread data**

Create a temporary test route that renders a spread with a background, a text element, and an image element on each side. Verify positioning, styling, and background rendering.

- [ ] **Step 3: Remove test route and commit**

```bash
git add components/page-renderer.tsx lib/sanitize.ts
git commit -m "feat: add shared page renderer with DOMPurify sanitization"
```

---

## Task 9: Book Reader with Page Flip

**Files:**
- Create: `components/book-reader.tsx`, `app/(public)/brochures/[slug]/page.tsx`

- [ ] **Step 1: Create book reader component**

Create `components/book-reader.tsx`:
- Props: `brochure: Brochure`, `initialPage?: number`, `mediaUrls: Record<string, string>`, `onPageChange?: (pageIndex: number) => void`
- Uses `HTMLFlipBook` from `react-pageflip`
- Container: takes full available space, centers the book
- Scale calculation: `useEffect` + `useCallback` on window resize, compute `min(containerWidth / 1440, containerHeight / 812)`, apply via CSS `transform: scale(${scale})` with `transform-origin: center center`
- Flatten spreads into individual pages:
  - Spread 0 → page 0 (cover left), page 1 (cover right)
  - Spread 1 → page 2 (page 1), page 3 (page 2)
  - Each page is a `PageRenderer` with `React.forwardRef`
- `HTMLFlipBook` props: `width={720}`, `height={812}`, `showCover={true}`, `flippingTime={800}`, `useMouseEvents={true}`, `swipeDistance={30}`, `maxShadowOpacity={0.5}`
- Check `prefers-reduced-motion` via `window.matchMedia("(prefers-reduced-motion: reduce)")`: if true, set `flippingTime={0}` and `usePortrait={false}` to disable 3D animation, then add a CSS `transition: opacity 300ms` on page containers for a simple crossfade effect instead of instant switch
- Store `flipBookRef` to expose imperative methods: `pageFlip().flipNext()`, `pageFlip().flipPrev()`, `pageFlip().flip(pageNum)`
- `onFlip` callback: track current page index, call `onPageChange`
- Handle wrap-around: when on last page and flipNext called, flip to page 0

- [ ] **Step 2: Create reader route page**

Create `app/(public)/brochures/[slug]/page.tsx`:
- `"use client"` directive
- Read `slug` from params (async in Next.js 16: `const { slug } = await params`)
- Read `page` from searchParams
- On mount: `getBrochureBySlug(slug)` — if not found, show "Brochure not found"
- Check `sessionStorage.getItem("unlocked:" + brochure.id)` — if not set, show `PasswordModal`
- On password unlock: set unlocked in sessionStorage, show reader
- Pre-resolve all mediaIds across all spreads + backgrounds to object URLs, store in `Record<string, string>`, revoke all on unmount
- If `?page=N`: convert page label to flattened page index. Page label "3" means spread index `Math.ceil(3/2) = 2`, flattened page index = `spreadIndex * 2` = 4. Formula: `const pageNum = parseInt(page); const spreadIdx = pageNum <= 0 ? 0 : Math.ceil(pageNum / 2); const flattenedPage = spreadIdx * 2;` Pass as `initialPage`.
- Render: full viewport dark background, `BookReader` centered, no header

- [ ] **Step 3: Test page flip**

- Create test brochure with 3+ spreads via console/dashboard
- Navigate to reader after password unlock
- Verify: cover displays, drag page to flip, smooth 3D animation, arrow keys work
- Window resize: book scales correctly
- `?page=3`: opens to the spread containing page 3

- [ ] **Step 4: Commit**

```bash
git add components/book-reader.tsx "app/(public)/brochures/[slug]/page.tsx"
git commit -m "feat: add book reader with react-pageflip 3D page turn animation"
```

---

## Task 10: Navigation Overlay + Thumbnail Modal

**Files:**
- Create: `components/navigation-overlay.tsx`, `components/thumbnail-modal.tsx`
- Modify: `components/book-reader.tsx`

- [ ] **Step 1: Create navigation overlay**

Create `components/navigation-overlay.tsx`:
- Props: `currentPageIndex: number`, `totalPages: number`, `onPrev: () => void`, `onNext: () => void`, `onCover: () => void`, `onViewAll: () => void`
- State: `visible: boolean` (controls opacity)
- Show on: `onMouseMove`, `onFocus`, `onTouchStart` within the overlay container
- Auto-hide: `setTimeout` to set `visible = false` after `NAV_OVERLAY_TIMEOUT_MS` (3s). Clear timeout on new interaction.
- CSS: `transition-opacity duration-300`, `opacity-0` when hidden, `opacity-100` when visible
- Layout: centered horizontally at bottom of reader, row of controls with dark semi-transparent background (`bg-black/60 backdrop-blur-sm rounded-full px-6 py-3`)
- Controls:
  - ChevronLeft icon button — `disabled={currentPageIndex === 0}`, `aria-label="Previous page"`
  - Page indicator text: `currentPageIndex <= 1 ? "Cover" : "Pages ${currentPageIndex}-${currentPageIndex+1} of ${totalPages}"`
  - ChevronRight icon button — `aria-label="Next page"`
  - Home icon button — `aria-label="Go to cover"`
  - Grid icon button — `aria-label="View all pages"`
- All buttons: `pointer-events-auto` so they're clickable even when overlay container catches events

- [ ] **Step 2: Create thumbnail modal**

Create `components/thumbnail-modal.tsx`:
- Props: `spreads: Spread[]`, `currentSpreadIndex: number`, `mediaUrls: Record<string, string>`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSelectSpread: (spreadIndex: number) => void`
- Full-screen dark overlay using shadcn Dialog (fullscreen variant)
- Title: "All Pages"
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`
- Each item: container with both left and right `PageRenderer` side by side at small scale (e.g., 200px wide)
- Label: "Cover" or "Pages N-M"
- Current spread: `ring-2 ring-blue-500`
- Click: `onSelectSpread(spreadIndex)`, `onOpenChange(false)`
- Scroll area if many spreads

- [ ] **Step 3: Wire into book reader**

Modify `components/book-reader.tsx`:
- Add `NavigationOverlay` positioned absolutely over the book container
- Add `ThumbnailModal` triggered by the View All button
- Connect callbacks:
  - `onPrev`: `flipBookRef.current.pageFlip().flipPrev()`
  - `onNext`: if last page, flip to 0, else `flipNext()`
  - `onCover`: `flip(0)`
  - `onViewAll`: open thumbnail modal
  - `onSelectSpread(index)`: `flip(index * 2)` (convert spread index to page index)
- Keyboard listeners (on the reader container, not window — to avoid conflicts):
  - `ArrowLeft` → prev (if not on cover)
  - `ArrowRight` → next
  - `Home` → cover
  - `Escape` → close thumbnail modal if open
- Make reader container focusable (`tabIndex={0}`) and auto-focus on mount

- [ ] **Step 4: Test complete reader**

- Hover/move mouse → nav overlay fades in
- Wait 3s → fades out
- Click arrows → page flips with animation
- Previous disabled on cover
- Next on last page → flips to cover
- View All → thumbnail grid opens
- Click thumbnail → jumps to spread, modal closes
- Keyboard: arrows, Home, Escape all work
- Mobile: tap to reveal overlay, swipe to flip

- [ ] **Step 5: Commit**

```bash
git add components/navigation-overlay.tsx components/thumbnail-modal.tsx components/book-reader.tsx
git commit -m "feat: add navigation overlay and thumbnail modal to reader"
```

---

## Task 11: Admin Dashboard

**Files:**
- Create: `app/(admin)/dashboard/page.tsx`
- Modify: `components/brochure-card.tsx`

- [ ] **Step 1: Add admin variant to brochure card**

Modify `components/brochure-card.tsx`:
- When `variant === "admin"`:
  - Show status `Badge` (draft = `bg-yellow-500/20 text-yellow-400`, published = `bg-green-500/20 text-green-400`)
  - Show page count: `${brochure.spreads.length * 2} pages`
  - Show last updated: relative time or formatted date
  - Show Edit button (pencil icon) → navigates to `/editor/${id}`
  - Render `actions` slot (DropdownMenu passed from parent)

- [ ] **Step 2: Create dashboard page**

Create `app/(admin)/dashboard/page.tsx`:
- `"use client"` directive
- On mount: `isAuthenticated()` check → if false, `router.push("/sign-in")`
- Load all brochures from `getAllBrochures()`
- Resolve cover thumbnails to object URLs
- Top section: heading "My Brochures" + "Create New Book" Button (+ icon)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- Each card: `BrochureCard variant="admin"` with DropdownMenu actions:
  - "Edit" → `/editor/${id}`
  - "Publish" / "Unpublish" → toggle status
  - "Preview" → open `/brochures/${slug}` in new tab
  - "Delete" → show AlertDialog confirmation
- Empty state: "No brochures yet. Create your first book!" with large CTA button

- [ ] **Step 3: Implement Create New Book**

On "Create New Book" click:
- `const id = generateId()`
- `const slug = "untitled-project-" + id.slice(0, 8)`
- Create `Brochure` with title "Untitled Project", status "draft", empty passwordHash
- Create 6 spreads (cover + 5 interior) with auto-generated page labels via `generatePageLabels()`
- Each spread: empty elements array, null backgrounds
- `await saveBrochure(newBrochure)`
- `router.push("/editor/" + id)`

- [ ] **Step 4: Implement Delete**

On Delete click:
- Open AlertDialog: "Delete '{title}'? This action cannot be undone."
- On confirm: `await deleteBrochure(id)` (removes brochure + all associated media)
- Refresh brochure list state

- [ ] **Step 5: Implement Publish/Unpublish**

On toggle:
- Load full brochure, flip status
- `await saveBrochure(updatedBrochure)`
- Update local state to reflect change

- [ ] **Step 6: Test dashboard**

- Visit `/dashboard` while authenticated
- Create new book → redirects to editor (404 OK until Task 13)
- Back to dashboard → new draft appears
- Publish → badge changes
- Preview → opens reader in new tab
- Delete → confirmation → removed
- Sign Out → back to gallery

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/dashboard/page.tsx" components/brochure-card.tsx
git commit -m "feat: add admin dashboard with brochure CRUD operations"
```

---

## Task 12: Search System

**Files:**
- Create: `lib/search.ts`, `app/(public)/search/page.tsx`
- Modify: `components/search-bar.tsx`, `components/header.tsx`

- [ ] **Step 1: Create search module**

Create `lib/search.ts`:

```typescript
import type { Brochure, SearchEntry } from "./types"

export interface SearchMatch {
  spreadIndex: number
  pageLabel: string
  snippet: string
}

export interface SearchResult {
  brochureId: string
  brochureTitle: string
  brochureSlug: string
  coverThumbnailMediaId: string | null
  matches: SearchMatch[]
  score: number
}

export function extractSearchText(brochure: Brochure): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const spread of brochure.spreads) {
    const texts: string[] = []
    for (const el of spread.elements) {
      if (el.type === "text") {
        // Strip HTML tags to get plain text
        const plain = (el.content as import("./types").TextContent).html
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        if (plain) texts.push(plain)
      }
    }
    if (texts.length > 0) {
      entries.push({
        spreadIndex: spread.spreadIndex,
        pageLabel: spread.leftPageLabel + "-" + spread.rightPageLabel,
        plainText: texts.join(" "),
      })
    }
  }
  return entries
}

export function searchBrochures(
  query: string,
  brochures: Brochure[]
): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const brochure of brochures) {
    if (brochure.status !== "published") continue
    const matches: SearchMatch[] = []
    let score = 0

    // Title match
    if (brochure.title.toLowerCase().includes(q)) {
      score += 10
    }

    // Description match
    if (brochure.description.toLowerCase().includes(q)) {
      score += 5
    }

    // Page content matches
    for (const entry of brochure.searchText) {
      const idx = entry.plainText.toLowerCase().indexOf(q)
      if (idx !== -1) {
        score += 1
        const start = Math.max(0, idx - 50)
        const end = Math.min(entry.plainText.length, idx + q.length + 50)
        const snippet = (start > 0 ? "..." : "") +
          entry.plainText.slice(start, end) +
          (end < entry.plainText.length ? "..." : "")
        matches.push({
          spreadIndex: entry.spreadIndex,
          pageLabel: entry.pageLabel,
          snippet,
        })
      }
    }

    if (score > 0) {
      results.push({
        brochureId: brochure.id,
        brochureTitle: brochure.title,
        brochureSlug: brochure.slug,
        coverThumbnailMediaId: brochure.coverThumbnailMediaId,
        matches,
        score,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 2: Add suggestions dropdown to search bar**

Modify `components/search-bar.tsx`:
- Add props: `onSearch?: (query: string) => SearchResult[]` (optional, for live suggestions)
- State: `suggestions: SearchResult[]`, `highlightedIndex: number`, `showSuggestions: boolean`
- On input change: debounce 300ms, call `onSearch(query)`, set suggestions
- Render dropdown below input (absolute positioned, `bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl`):
  - Each suggestion: brochure title (bold), first match page label + truncated snippet
  - Max 5 items
  - Highlighted item: `bg-zinc-800`
- ArrowUp/ArrowDown: navigate suggestions
- Enter: if suggestion highlighted, navigate to that brochure page; else navigate to `/search?q=...`
- Escape: close dropdown
- Click outside: close dropdown

- [ ] **Step 3: Create search results page**

Create `app/(public)/search/page.tsx`:
- `"use client"` directive
- Read `q` from searchParams (async in Next.js 16)
- On mount + when `q` changes: load all brochures, `searchBrochures(q, brochures)`
- Resolve cover thumbnail mediaIds to URLs
- Header: `Results for "${q}" — ${totalMatches} results`
- Each result group: cover thumbnail + brochure title, then list of matches:
  - Each match: clickable page label link (`/brochures/${slug}?page=${pageNum}`) + snippet with query bolded using `<mark className="bg-yellow-500/30 text-yellow-200">`
- Empty state: "No results found. Try a different search term."

- [ ] **Step 4: Wire search bar in header**

Modify `components/header.tsx`:
- Read initial query from `useSearchParams().get("q")`
- Pass to `SearchBar` as `initialQuery`
- `onSubmit`: `router.push("/search?q=" + encodeURIComponent(query))` or `router.push("/")` if empty
- Pass live search function to `SearchBar` for suggestions

- [ ] **Step 5: Test**

- Type in search bar → suggestions dropdown appears
- Enter → results page with grouped results
- Click page label → navigates to reader at correct page
- Clear "x" → returns to gallery

- [ ] **Step 6: Commit**

```bash
git add lib/search.ts components/search-bar.tsx "app/(public)/search/page.tsx" components/header.tsx
git commit -m "feat: add client-side search with suggestions and results page"
```

---

## Task 13: Editor — Core Canvas & Element Selection

**Files:**
- Create: `app/(admin)/editor/[id]/page.tsx`, `components/editor/editor-canvas.tsx`, `components/editor/element-wrapper.tsx`

- [ ] **Step 1: Create editor page shell**

Create `app/(admin)/editor/[id]/page.tsx`:
- `"use client"` directive
- Auth guard: if `!isAuthenticated()`, redirect to `/sign-in`
- Load brochure by `id` from IndexedDB on mount
- State: `brochure`, `currentSpreadIndex`, `selectedElementId`, `mediaUrls: Record<string, string>`
- Resolve all mediaIds to object URLs on mount/brochure change
- Layout (flex, full height):
  - **Top bar** (`h-14`): back link (← Dashboard), editable title input, spread nav (prev/next + "Cover" / "Pages 3-4"), Save button
  - **Main area** (flex-1, flex row):
    - **Left sidebar** (`w-56`): tool palette (buttons for Insert Text, Insert Image, Backgrounds header) — functionality wired in Tasks 14, 15, 18
    - **Center** (flex-1): `EditorCanvas` component
    - **Right sidebar** (`w-56`): placeholder for layer panel (Task 16)
  - **Bottom** (`h-24`): placeholder for spread strip (Task 18)

- [ ] **Step 2: Create editor canvas**

Create `components/editor/editor-canvas.tsx`:
- Props: `spread: Spread`, `selectedElementId: string | null`, `onSelectElement: (id: string | null) => void`, `onUpdateElement: (id: string, updates: Partial<BrochureElement>) => void`, `mediaUrls: Record<string, string>`
- Container: centers and scales the 1440x812 canvas to fit available space (same scale formula as reader)
- Render two "page" areas side by side (each 720x812) with a subtle center line
- Background rendering: same logic as `page-renderer.tsx` but for the full spread
- Render each element via `ElementWrapper`
- Click on empty canvas: `onSelectElement(null)` to deselect

- [ ] **Step 3: Create element wrapper**

Create `components/editor/element-wrapper.tsx`:
- Props: `element: BrochureElement`, `selected: boolean`, `onSelect: () => void`, `onUpdate: (updates: Partial<BrochureElement>) => void`, `mediaUrls: Record<string, string>`
- Absolutely positioned at `{ left: element.x, top: element.y, width: element.width, height: element.height }`
- `transform: rotate(${element.rotation}deg)`
- Click: `onSelect()`
- When selected: show blue dashed border + 8 resize handles (small squares at corners + midpoints)
- **Drag to move**: `onMouseDown` on element body → track mouse delta → update `x`, `y`, snap to `GRID_SIZE` (round to nearest 20). Additionally, check proximity (within 5px) to edges and centers of sibling elements — if close, snap to align and show a colored guide line (thin blue line spanning the canvas).
- **Resize**: `onMouseDown` on handle → track delta → update `width`/`height` (and `x`/`y` for top/left handles), snap to grid, minimum size 40x40. Same snap-to-edge/center proximity detection applies during resize.
- **Alignment guides**: render temporary `<div>` lines (absolute positioned, 1px wide/tall, blue) when snap-to-element triggers. Remove guides on mouse up. Guide detection: compare element edges (top, bottom, left, right) and centers (horizontal midpoint, vertical midpoint) against all sibling elements' edges and centers.
- If `element.locked`: show lock icon overlay, disable drag/resize
- Render children: `TextElement` or `ImageElement` based on type (created in Tasks 14-15, placeholder div for now)

- [ ] **Step 4: Test**

- Navigate to editor for a brochure with elements
- Canvas renders at correct scale
- Click element → selected (blue border + handles)
- Drag → moves with grid snap
- Resize handles → resizes correctly
- Click empty canvas → deselects

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/editor/[id]/page.tsx" components/editor/editor-canvas.tsx components/editor/element-wrapper.tsx
git commit -m "feat: add editor canvas with element selection, drag, and resize"
```

---

## Task 14: Editor — Text Element & Formatting Toolbar

**Files:**
- Create: `components/editor/text-element.tsx`, `components/editor/toolbar.tsx`
- Modify: `components/editor/element-wrapper.tsx`, `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Create text element**

Create `components/editor/text-element.tsx`:
- Props: `content: TextContent`, `selected: boolean`, `onContentChange: (content: TextContent) => void`
- Render a div with `contentEditable={selected}`, `suppressContentEditableWarning`
- Apply styles: `fontFamily`, `fontSize + "px"`, `color`, `fontWeight`, `textAlign: alignment`, `lineHeight`, `letterSpacing + "px"`, `opacity`
- Set initial HTML via `ref.current.innerHTML = sanitizeHtml(content.html)` (only on mount or when not focused)
- On `onInput`: read `innerHTML`, sanitize, call `onContentChange({ ...content, html: sanitizedHtml })`
- When not selected: render as static div with sanitized innerHTML
- `cursor-text` when selected, `cursor-default` when not

- [ ] **Step 2: Create formatting toolbar**

Create `components/editor/toolbar.tsx`:
- Props: `content: TextContent`, `onChange: (content: TextContent) => void`, `position: { x: number, y: number }`
- Floating bar positioned absolutely near the selected text element (above it, clamped to canvas bounds)
- Dark background with border, rounded, `shadow-xl`, `z-50`
- Controls (compact row):
  - Font family: `<select>` with options: Inter, Georgia, "Courier New", Arial, "Times New Roman"
  - Font size: number input (min 8, max 120, step 1)
  - Color: `<input type="color">` styled as a small swatch
  - Bold toggle: **B** button, active state if fontWeight includes "bold" or "700"
  - Alignment: 3 icon buttons (left, center, right), active highlights current
  - Opacity: small range slider (0 to 1, step 0.05)
- Each control: on change, call `onChange({ ...content, [property]: newValue })`
- More controls (line-height, letter-spacing) in a second row or expandable section

- [ ] **Step 3: Wire into editor page**

Modify editor page:
- When selected element is type "text": show `Toolbar` above it
- Calculate toolbar position from element's `x, y` (offset above element, clamped to canvas)
- Toolbar `onChange` → update element content via `onUpdateElement`

Modify `element-wrapper.tsx`:
- Render `TextElement` when `element.type === "text"`
- Pass `content`, `selected`, and `onContentChange` (which calls `onUpdate({ content: newContent })`)

- [ ] **Step 4: Implement Insert Text in left sidebar**

In editor page, on "Insert Text" button click:
- Create new `BrochureElement`:
  - `id: generateId()`, `type: "text"`, `x: 210, y: 300` (roughly centered on left page), `width: 300, height: 100`, `rotation: 0`, `zIndex: spread.elements.length`, `locked: false`
  - `content: { html: "", fontFamily: "Inter", fontSize: 16, color: "#ffffff", fontWeight: "400", alignment: "left", lineHeight: 1.5, letterSpacing: 0, opacity: 1 }`
- Add to current spread's elements array
- Set as selected element

- [ ] **Step 5: Test**

- Insert Text → element appears on canvas
- Click to select → toolbar appears, element becomes editable
- Type text → content updates in real time
- Change font, size, color, bold, alignment → element updates
- Deselect → toolbar hides, text displays as static
- Drag/resize → works as before

- [ ] **Step 6: Commit**

```bash
git add components/editor/text-element.tsx components/editor/toolbar.tsx components/editor/element-wrapper.tsx
git commit -m "feat: add text element editing with formatting toolbar"
```

---

## Task 15: Editor — Image Element

**Files:**
- Create: `components/editor/image-element.tsx`
- Modify: `components/editor/element-wrapper.tsx`, `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Create image element**

Create `components/editor/image-element.tsx`:
- Props: `content: ImageContent`, `mediaUrl: string | null`
- If `mediaUrl`: render `<img src={mediaUrl} style={{ objectFit: content.objectFit }} className="w-full h-full" alt="" />`
- If no `mediaUrl`: render placeholder div with image icon and "No image" text, muted colors

- [ ] **Step 2: Wire into element wrapper**

Modify `element-wrapper.tsx`:
- Render `ImageElement` when `element.type === "image"`
- Pass `content` and resolved `mediaUrl` from `mediaUrls[content.mediaId]`

- [ ] **Step 3: Implement Insert Image in left sidebar**

In editor page, on "Insert Image" button click:
- Create a hidden `<input type="file" accept="image/*">` and trigger click
- On file selected:
  - `validateImageFile(file)` — if invalid, show error (toast or inline)
  - If valid:
    - `const mediaId = generateId()`
    - `await saveMedia({ id: mediaId, brochureId: brochure.id, blob: file, mimeType: file.type, createdAt: new Date().toISOString() })`
    - Create new `BrochureElement`: `type: "image"`, `x: 210, y: 200`, `width: 300, height: 200`, `content: { mediaId, objectFit: "cover" }`
    - Add to spread, select it
    - Resolve new mediaId to URL: `mediaUrls[mediaId] = URL.createObjectURL(file)`

- [ ] **Step 4: Add object-fit selector**

When an image element is selected, show in the right sidebar (or as part of a properties panel):
- "Object Fit" dropdown: Cover, Contain, Fill
- On change: update `content.objectFit` via `onUpdateElement`

- [ ] **Step 5: Test**

- Insert Image → file picker → select .jpg → image appears on canvas
- Drag/resize → works
- Change object-fit → rendering changes
- Select large file (>10MB) → error message
- Select non-image file → error message
- Reload page → image persists from IndexedDB

- [ ] **Step 6: Commit**

```bash
git add components/editor/image-element.tsx components/editor/element-wrapper.tsx
git commit -m "feat: add image element with upload and object-fit options"
```

---

## Task 16: Editor — Layer Panel

**Files:**
- Create: `components/editor/layer-panel.tsx`
- Modify: `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Create layer panel**

Create `components/editor/layer-panel.tsx`:
- Props: `elements: BrochureElement[]`, `selectedId: string | null`, `onSelect: (id: string) => void`, `onReorder: (fromIndex: number, toIndex: number) => void`, `onToggleLock: (id: string) => void`, `onDelete: (id: string) => void`
- Render list sorted by zIndex descending (highest = top of visual list)
- Each row:
  - Type icon: "T" text icon or image icon
  - Label: for text, first ~20 chars of plain text; for image, "Image"
  - Lock toggle button (lock/unlock icon)
  - Delete button (trash icon), hidden if locked
- Selected row: `bg-zinc-800` highlight
- Click row: `onSelect(id)`
- Drag rows to reorder: on drop, call `onReorder(oldIndex, newIndex)` which recalculates zIndex values for all elements in the spread

- [ ] **Step 2: Wire into editor page**

Add `LayerPanel` to the right sidebar of the editor page.
- `onReorder`: update zIndex values so the visual order matches the list
- `onToggleLock`: toggle `element.locked`
- `onDelete`: remove element from spread (with undo support — wired in Task 17)

- [ ] **Step 3: Add keyboard shortcuts**

In editor page, add `onKeyDown` handler:
- `Delete` or `Backspace`: if element selected and not locked, delete it
- `Ctrl+D` / `Cmd+D`: if element selected, duplicate it (copy with `x+20, y+20`, new `id`, increment `zIndex`)
- Prevent default for these keys when canvas is focused

- [ ] **Step 4: Test**

- Multiple elements on canvas → layer panel shows ordered list
- Drag to reorder → zIndex updates, canvas reflects
- Lock → can't drag/resize on canvas, lock icon visible in panel
- Delete → removed from canvas and panel
- Ctrl+D → duplicate appears offset

- [ ] **Step 5: Commit**

```bash
git add components/editor/layer-panel.tsx
git commit -m "feat: add layer panel with z-order, lock, and delete"
```

---

## Task 17: Editor — Undo/Redo & Autosave

**Files:**
- Create: `components/editor/history.ts`
- Modify: `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Create history manager**

Create `components/editor/history.ts`:

```typescript
export interface HistoryEntry {
  undo: () => void
  redo: () => void
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxSize = 50

  push(entry: HistoryEntry) {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.maxSize) this.undoStack.shift()
    this.redoStack = []
  }

  undo(): boolean {
    const entry = this.undoStack.pop()
    if (!entry) return false
    entry.undo()
    this.redoStack.push(entry)
    return true
  }

  redo(): boolean {
    const entry = this.redoStack.pop()
    if (!entry) return false
    entry.redo()
    this.undoStack.push(entry)
    return true
  }

  get canUndo() { return this.undoStack.length > 0 }
  get canRedo() { return this.redoStack.length > 0 }
  clear() { this.undoStack = []; this.redoStack = [] }
}
```

- [ ] **Step 2: Wire history into editor**

In the editor page:
- `const historyRef = useRef(new HistoryManager())`
- Create a helper `pushHistory(undo, redo)` that wraps the manager
- Wrap ALL element mutations in history entries:
  - Move: capture old/new `{x, y}`
  - Resize: capture old/new `{width, height, x, y}`
  - Content change: capture old/new content
  - Add element: undo = remove, redo = re-add
  - Delete element: undo = re-add, redo = remove
  - Reorder: capture old/new zIndex arrays
  - Lock toggle: capture old/new locked state
- Keyboard: `Ctrl+Z` / `Cmd+Z` → `history.undo()`, `Ctrl+Shift+Z` / `Cmd+Shift+Z` → `history.redo()`
- Top bar: Undo/Redo icon buttons, disabled when `!canUndo` / `!canRedo`

- [ ] **Step 3: Implement autosave**

In the editor page:
- `isDirty` state: set `true` on any brochure mutation, `false` after save
- `useEffect` with `setInterval(AUTOSAVE_INTERVAL_MS)`:
  - If dirty: `extractSearchText(brochure)` → update `brochure.searchText` → `saveBrochure(brochure)` → set dirty false
- Manual Save button: same logic, immediate
- Top bar indicator: "Saved" (green dot) or "Unsaved changes" (yellow dot)
- `beforeunload` handler: if dirty, return confirmation string

- [ ] **Step 4: Test**

- Make changes → "Unsaved changes" indicator
- Wait 30s → auto-saves, shows "Saved"
- Click Save → immediate save
- Ctrl+Z → undoes last action
- Ctrl+Shift+Z → redoes
- Try navigating away dirty → browser warning
- Undo/Redo buttons enable/disable correctly

- [ ] **Step 5: Commit**

```bash
git add components/editor/history.ts
git commit -m "feat: add undo/redo history and autosave to editor"
```

---

## Task 18: Editor — Spread Management & Backgrounds

**Files:**
- Create: `components/editor/spread-strip.tsx`
- Modify: `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Create spread strip**

Create `components/editor/spread-strip.tsx`:
- Props: `spreads: Spread[]`, `currentIndex: number`, `onSelect: (index: number) => void`, `onAdd: () => void`, `onRemove: (index: number) => void`, `onReorder: (from: number, to: number) => void`
- Horizontal scrollable container (`overflow-x-auto flex gap-2 p-2`), fixed height `h-24`
- Each spread thumbnail: small container (~120x68px ratio matching 1440:812) with dark bg
  - Label: "Cover" or "Pages N-M"
  - Current: `ring-2 ring-blue-500`
  - Click: `onSelect(spreadIndex)`
  - Right-click / context menu: "Delete spread" (disabled for cover/index 0)
- Drag to reorder: HTML drag-and-drop on thumbnails, call `onReorder`
- "+" button at end: `onAdd()`

- [ ] **Step 2: Implement spread CRUD in editor**

In editor page:
- **Add**: create new empty spread, append after last, regenerate all page labels with `generatePageLabels()`, push to history
- **Remove**: confirm if spread has elements ("This spread has content. Delete anyway?"), remove spread, delete associated media, regenerate labels, push to history. Prevent deleting cover (index 0).
- **Reorder**: update `spreadIndex` for all spreads, regenerate labels, push to history

- [ ] **Step 3: Implement background tool in left sidebar**

In the left sidebar, under "Backgrounds" section:
- Three buttons/areas:
  - "Left Page BG" — hidden file input, on select: save to media store, set `spread.leftBackgroundMediaId`
  - "Right Page BG" — same for right
  - "Full Spread BG" — same for full spread; when set, clear left/right individual backgrounds
- Each shows a tiny preview if set, with an "x" to remove
- When setting individual L/R backgrounds, clear `fullSpreadBackgroundMediaId`

- [ ] **Step 4: Cover thumbnail on save**

When saving (autosave/manual):
- Set `brochure.coverThumbnailMediaId` to the cover spread's first available background: `fullSpreadBackgroundMediaId || leftBackgroundMediaId || null`

- [ ] **Step 5: Test**

- Spread strip shows all spreads at bottom
- Click to navigate between spreads
- Add new spread → appears in strip with correct labels
- Delete spread → removed, labels regenerated
- Drag to reorder → order updates
- Set backgrounds → visible on canvas
- Full spread BG → covers both pages

- [ ] **Step 6: Commit**

```bash
git add components/editor/spread-strip.tsx
git commit -m "feat: add spread management strip and background tools"
```

---

## Task 19: Editor — Password & Slug Settings

**Files:**
- Modify: `app/(admin)/editor/[id]/page.tsx`

- [ ] **Step 1: Add settings dialog**

In the editor top bar, add a gear icon button that opens a shadcn Dialog:
- **Title field**: text input, pre-filled with brochure title (also updates the top bar title)
- **Slug field**: text input, auto-generated from title via `slugify()`, editable for manual override. Show preview: `yoursite.com/brochures/${slug}`
- **Password field**: password input + "Set Password" button. On set: `hashPassword(value)` → save to `brochure.passwordHash`. Show checkmark indicator if password is already set.
- **Description field**: textarea
- "Save Settings" button: validates slug uniqueness, saves brochure

- [ ] **Step 2: Validate slug uniqueness**

On slug change or save:
- Load brochure index from localStorage
- Check if any other brochure has the same slug
- If duplicate: show error "This URL is already in use"
- Disable save until resolved

- [ ] **Step 3: Auto-update slug on title change**

When title changes and slug hasn't been manually edited:
- Auto-regenerate slug via `slugify(newTitle)` + `-${id.slice(0,8)}` suffix for uniqueness

- [ ] **Step 4: Test**

- Open settings → fields populated
- Change title → slug auto-updates
- Manually edit slug → persists
- Set password → hash saved
- Duplicate slug → error shown
- Save → settings persist

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/editor/[id]/page.tsx"
git commit -m "feat: add brochure settings with password and slug management"
```

---

## Task 20: Integration Testing & Polish

**Files:**
- Modify: various files for fixes

- [ ] **Step 1: Test full public flow end-to-end**

1. Create brochure in admin: add text + image elements across multiple spreads, set backgrounds
2. Set password and publish
3. Visit gallery → brochure card with cover thumbnail
4. Click → password modal → wrong password → shake + error
5. Correct password → reader opens, book displays cover
6. Flip through all spreads → 3D page turn animation is smooth
7. View All → thumbnail grid → click thumbnail → jumps to spread
8. Keyboard shortcuts work (arrows, Home, Escape)

- [ ] **Step 2: Test search flow**

1. Type query in search bar → suggestions dropdown
2. Enter → results page, grouped by brochure
3. Click page label → reader opens at correct page after password gate
4. Clear "x" → returns to gallery

- [ ] **Step 3: Test admin flow**

1. Sign in → dashboard
2. Create new book → editor opens
3. Add text elements, format with toolbar
4. Add images via upload
5. Set page backgrounds (left, right, full spread)
6. Add/remove/reorder spreads
7. Undo/redo (Ctrl+Z/Ctrl+Shift+Z)
8. Duplicate element (Ctrl+D)
9. Lock/unlock in layer panel
10. Set password and slug in settings
11. Publish → preview opens in new tab
12. Delete brochure with confirmation

- [ ] **Step 4: Responsive testing**

- Desktop 1920x1080: full layout works
- Tablet 768x1024: grids adjust, reader scales
- Mobile 375x812: single column, touch page flip, tap for nav overlay

- [ ] **Step 5: Fix any issues**

Address bugs found in steps 1-4.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "fix: integration testing fixes and polish"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffold | package.json, layout, config, constants |
| 2 | Types & utilities | lib/types.ts, lib/utils.ts |
| 3 | Storage layer | lib/db.ts, brochure-store.ts, media-store.ts |
| 4 | Auth system | lib/auth.ts, sign-in page |
| 5 | Global header | header.tsx, search-bar.tsx |
| 6 | Public gallery | brochure-card.tsx, gallery page |
| 7 | Password gate | password-modal.tsx |
| 8 | Page renderer | page-renderer.tsx (shared), sanitize.ts |
| 9 | Book reader | book-reader.tsx, reader route |
| 10 | Nav overlay + thumbnails | navigation-overlay.tsx, thumbnail-modal.tsx |
| 11 | Admin dashboard | dashboard page, card admin variant |
| 12 | Search system | lib/search.ts, search page, suggestions |
| 13 | Editor canvas | editor page, editor-canvas.tsx, element-wrapper.tsx |
| 14 | Text editing | text-element.tsx, toolbar.tsx |
| 15 | Image editing | image-element.tsx |
| 16 | Layer panel | layer-panel.tsx |
| 17 | Undo/redo + autosave | history.ts |
| 18 | Spread management | spread-strip.tsx, backgrounds |
| 19 | Password & slug | settings dialog |
| 20 | Integration testing | Full flow verification |
