# Digital Brochure Hub — v1 Design Spec

## Overview

A digital brochure hub where visitors browse brochure thumbnails, unlock a brochure with a brochure-specific password, and read it as a realistic open-book with 3D page flip animations. Includes an admin dashboard for brochure creation, editing, and publishing.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) + Tailwind + shadcn/ui | Full-stack, file routing, Vercel-ready |
| App structure | Single app with route groups | Clean separation without monorepo overhead |
| Storage | localStorage (metadata) + IndexedDB (media) | No backend needed for v1 |
| Editor approach | DOM-based (positioned divs, contenteditable) | Simpler, shares rendering with reader |
| Page flip | react-pageflip (StPageFlip) | Realistic 3D CSS page turn with drag/swipe |
| Theme | Dark mode default | Brochures pop against dark backgrounds |
| Auth | Local credentials in localStorage (SHA-256 hashed) | Simple, no external service |

## v1 Scope

### Included
- Public gallery with brochure cards
- Password gate per brochure
- Spread reader with 3D page flip, navigation overlay, keyboard shortcuts, View All modal
- Admin sign-in (localStorage credentials, one-time setup)
- Admin dashboard (create, edit, delete, publish/unpublish, preview)
- Editor with text + image tools, backgrounds, drag/resize, layers, undo/redo
- Client-side full-text search with results page and deep-linking

### Deferred to v2
- Audio/video elements in editor
- Templates
- Analytics (views, per-page stats)
- Autosuggest refinements
- Slug management and 301 redirects
- Accessible PDF alternative
- Duplicate brochure
- Edit locking
- Rate-limited password attempts

---

## App Structure & Routing

```
app/
├── (public)/
│   ├── page.tsx                    # Brochure gallery homepage
│   ├── search/page.tsx             # Search results page
│   └── brochures/[slug]/page.tsx   # Reader view (password gate + spread viewer)
├── (admin)/
│   ├── sign-in/page.tsx            # Admin login
│   ├── dashboard/page.tsx          # Brochure management grid
│   └── editor/[id]/page.tsx        # Spread editor canvas
├── layout.tsx                      # Root layout (dark theme, global header)
└── globals.css
```

### Global Header

Adapts by context:
- **Public:** logo | search bar | Sign In button
- **Admin:** logo | search bar | avatar/Admin menu
- **Reader:** hidden or minimal (immersive mode)

All pages are effectively client components at the leaf level since data lives in localStorage/IndexedDB. Next.js provides file-based routing and `next/image` optimization.

---

## Data Model & Storage

### localStorage

```
"brochure_index"  → BrochureIndex[]   (lightweight: id, title, slug, status, updatedAt)
"admin_session"   → { username, loggedInAt, expiresAt }
"admin_creds"     → { username, passwordHash }
```

### IndexedDB (`BrochureHubDB`)

```
Object stores:
  "brochures"  → Full Brochure objects (avoids localStorage size limits)
  "media"      → { id, brochureId, blob, mimeType, createdAt }
```

localStorage holds only a lightweight index for fast gallery rendering. Full brochure data (spreads, elements, search text) lives in IndexedDB to avoid the ~5MB localStorage quota. Admin session expires after 24 hours.

### Type Definitions

```typescript
interface Brochure {
  id: string
  title: string
  slug: string
  description: string
  status: "draft" | "published"
  passwordHash: string
  coverThumbnailMediaId: string | null  // references IndexedDB media store
  spreads: Spread[]
  searchText: SearchEntry[]
  createdAt: string
  updatedAt: string
}

interface Spread {
  id: string
  spreadIndex: number
  leftPageLabel: string
  rightPageLabel: string
  leftBackgroundMediaId: string | null      // references IndexedDB media store
  rightBackgroundMediaId: string | null     // references IndexedDB media store
  fullSpreadBackgroundMediaId: string | null // references IndexedDB media store
  elements: BrochureElement[]
}

interface BrochureElement {
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

interface TextContent {
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

interface ImageContent {
  mediaId: string
  objectFit: "cover" | "contain" | "fill"
}

interface SearchEntry {
  spreadIndex: number
  pageLabel: string
  plainText: string
}
```

### Page Label Generation

Page labels are auto-generated from spread index:
- Spread 0: `leftPageLabel = "Cover Left"`, `rightPageLabel = "Cover Right"`
- Spread 1: `leftPageLabel = "1"`, `rightPageLabel = "2"`
- Spread 2: `leftPageLabel = "3"`, `rightPageLabel = "4"`
- Formula: `leftPageLabel = String((spreadIndex * 2) - 1)`, `rightPageLabel = String(spreadIndex * 2)`

Labels are regenerated automatically when spreads are added, removed, or reordered. Labels are not user-editable in v1.

### Media URL Handling

- Media URLs are created via `URL.createObjectURL()` from IndexedDB blobs at render time
- URLs are revoked via `URL.revokeObjectURL()` on component unmount
- Elements reference media by `mediaId` which maps to the IndexedDB store

### Search Index

- At save/publish time, plain text is extracted from all text elements per spread
- Stored as `searchText` array on the brochure object
- Used for client-side full-text search

---

## Public Reader Experience

### Gallery Page

Dark background, responsive grid of brochure cards. Each card shows cover thumbnail and title. Hover reveals subtle glow/lift effect. Click opens password modal.

### Password Gate

Modal overlay with single password input field.
- On submit: hash input with SHA-256, compare against brochure `passwordHash`
- Correct: store `sessionStorage["unlocked:<brochureId>"] = "true"`, open reader (preserving `?page=N` if present)
- Wrong: shake animation + inline error message
- Close modal: return to gallery
- Reader route checks `sessionStorage["unlocked:<brochureId>"]` before rendering; if missing, shows password gate

### Reader View

Full-viewport dark background. Book rendered via `react-pageflip`, centered using:

```
scale = min(availableWidth / 1440, availableHeight / 812)
```

- Canonical spread: 1440x812
- Canonical single page: 720x812
- Book opens on cover spread (pages 0-1)
- Flip triggered by: drag page corner, click arrows, swipe (mobile), keyboard arrows
- On last page, Next flips back to cover
- Aspect ratio preserved at all times; pillarbox/letterbox as needed

### Page Flip Animation

Using `react-pageflip` (StPageFlip wrapper):
- Realistic 3D CSS page turn with curl and fold
- Drag to flip: grab page corner and pull across
- Click/tap arrows: triggers animated flip
- Swipe on mobile: touch gesture flips
- Keyboard arrows: also triggers flip animation
- `prefers-reduced-motion`: falls back to crossfade

### Navigation Overlay

Fades in on hover/focus/tap, fades out after 3 seconds idle:
- **Previous arrow** — disabled on cover spread
- **Next arrow** — loops to cover from last spread
- **Page indicator** — "Cover" or "Pages 3-4 of 10"
- **Cover button** — always jumps to cover
- **View All button** — opens thumbnail modal

### Thumbnail Modal (View All)

Full-screen dark overlay:
- 5-column grid on desktop
- 2-column grid on tablet
- 1-column grid on mobile
- Each item: spread thumbnail labeled by page range
- Current spread visually highlighted
- Click jumps to that spread with flip animation

### Keyboard Shortcuts

- Left/Right arrows: previous/next page
- Home: jump to cover
- Escape: close thumbnail modal or exit reader

---

## Admin System

### Sign-in

Simple page with username/password form.
- First visit: if no `admin_creds` in localStorage, prompt to create credentials (one-time setup)
- Password stored as SHA-256 hash
- On success: set `admin_session` in localStorage, redirect to dashboard
- On failure: inline error, preserve username field

### Dashboard

Dark theme, grid of brochure cards with management metadata:
- Cover thumbnail
- Title
- Page count
- Last updated timestamp
- Status badge (draft / published)
- Edit button

**Actions toolbar:**
- **Create New Book** — creates draft with "Untitled Project", 1 cover spread + 5 interior spreads (pages 1-10), all empty
- **Delete** — confirmation dialog, removes brochure + all associated media from IndexedDB
- **Publish/Unpublish** — toggles brochure status
- **Preview as Reader** — opens reader view in new tab
- **Sign Out** — clears `admin_session` from localStorage, redirects to gallery

### Editor

**Layout:**
- **Top bar:** editable brochure title, spread navigator (prev/next), Save button, back to dashboard
- **Left sidebar:** tool palette (Insert Text, Insert Image, Backgrounds)
- **Center:** current spread at 1440x812, two pages side by side
- **Right sidebar:** layer panel (z-order list, lock/unlock, delete per element)
- **Bottom:** spread strip (thumbnail row of all spreads; add/remove via buttons, drag-and-drop to reorder; page labels auto-regenerate after reorder)

**Element Editing:**
- Click to select, drag to move, corner handles to resize
- **Text:** contenteditable with floating toolbar — font family, size, color, weight, alignment, line-height, letter-spacing, opacity
- **Image:** file upload dialog, stores blob in IndexedDB, renders with object-fit options (cover/contain/fill)
- Selected element shows properties in right sidebar

**Editor Features:**
- Undo/redo — command stack pattern (`{ undo(), redo() }` per action)
- Duplicate element (Ctrl+D)
- Delete element (Delete/Backspace key)
- Snap-to-grid alignment guides (20px grid, snap-to-edge and snap-to-center of other elements)
- Autosave to localStorage every 30 seconds
- Unsaved changes warning on navigation (beforeunload)

---

## Search System

### Implementation

Client-side full-text search across all published brochures. At save/publish time, plain text is extracted from all text elements per spread and stored in `searchText` on the brochure.

Search uses simple string matching (`indexOf` / regex) for v1. Results scored by match count, title matches ranked higher.

### Search Bar (Global Header)

As user types (300ms debounce):
- Filter across brochure titles and page text
- Dropdown shows top 5-8 suggestions grouped by brochure
- Each suggestion: brochure title + matching page label + short snippet
- Arrow keys navigate suggestions
- Enter goes to results page
- Escape closes dropdown

### Results Page (`/search?q=keyword`)

- Query persists in search bar with clear "x" button
- Header: "Results for 'keyword' — N results"
- Results grouped by brochure: cover thumbnail, title, then matching pages listed
- Each match: page label (clickable link), text snippet with keyword bolded
- Clicking page label navigates to `/brochures/:slug?page=N`
- Empty state: "No results found. Try a different search term."

### Deep-linking

Reader route reads `?page=N` from URL. After password validation, opens book to the spread containing that page. Password gate remembers target page and navigates after unlock.

---

## Component Architecture

### Dependencies

- `next` — framework
- `react-pageflip` — 3D page flip animations
- `tailwindcss` — styling
- shadcn/ui — Button, Dialog, Input, Card, DropdownMenu, Sheet, Tooltip
- `idb` — lightweight IndexedDB wrapper (promise-based)
- Web Crypto API — SHA-256 password hashing (native, no extra dependency)

### Component Tree

```
components/
├── ui/                        # shadcn/ui primitives
├── header.tsx                 # Global header (adapts by context)
├── search-bar.tsx             # Search input with suggestions dropdown
├── brochure-card.tsx          # Gallery/dashboard card
├── password-modal.tsx         # Brochure unlock gate
├── book-reader.tsx            # react-pageflip wrapper + scaling logic
├── page-renderer.tsx          # Renders a single page (elements on background)
├── navigation-overlay.tsx     # Reader controls (arrows, page indicator, etc.)
├── thumbnail-modal.tsx        # View All spreads grid
└── editor/
    ├── editor-canvas.tsx      # The spread editing surface
    ├── element-wrapper.tsx    # Drag/resize/select wrapper per element
    ├── text-element.tsx       # Contenteditable text block
    ├── image-element.tsx      # Image with object-fit
    ├── toolbar.tsx            # Text formatting floating toolbar
    ├── layer-panel.tsx        # Right sidebar z-order list
    ├── spread-strip.tsx       # Bottom spread thumbnails
    └── history.ts             # Undo/redo command stack
```

### Storage Layer

```
lib/
├── db.ts             # IndexedDB wrapper (brochures + media stores via idb)
├── brochure-store.ts # CRUD for brochures (IndexedDB) + index sync (localStorage)
├── media-store.ts    # Media blob CRUD + createObjectURL lifecycle
├── search.ts         # Client-side search indexing + querying
└── auth.ts           # Admin credential management + session (localStorage)
```

### Key Patterns

- `page-renderer.tsx` is shared between reader and editor — same rendering, editor adds interaction handles on top
- Media URLs created via `URL.createObjectURL()` from IndexedDB blobs, revoked on unmount
- Undo/redo uses command stack: each action pushes `{ undo(), redo() }` onto the stack
- Autosave runs on a 30-second interval, saves full brochure state to localStorage

---

## Layout & Sizing

- App target viewport: 1920x1080
- Reader safe area: centered with minimum 8px outer margin
- Preferred desktop side margin: 32px
- Canonical spread: 1440x812
- Canonical single page: 720x812
- Scale: `min(availableWidth / 1440, availableHeight / 812)`
- Aspect ratio preserved at all times

---

## Accessibility (v1)

- Keyboard navigation for all reader controls
- ARIA labels on icon buttons
- Visible focus states
- Tap/focus equivalents for mobile (no hover-only interactions)
- `prefers-reduced-motion` respected (crossfade fallback)
- Searchable text exists as real text, not flattened imagery

---

## Security (v1)

- Passwords hashed with SHA-256 (Web Crypto API), never stored in plaintext. Note: SHA-256 is a convenience measure for client-side-only storage — not production-grade password hashing. If the app gains a backend, migrate to bcrypt/argon2.
- Admin session checked on all admin routes
- File uploads validated for type (image/* only in v1) and size (max 10MB per image)
- Rich text HTML sanitized to prevent XSS
- Draft brochures excluded from public gallery and search
