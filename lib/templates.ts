import { generateId } from "@/lib/utils"
import { PAGE_WIDTH, CANVAS_WIDTH, PAGE_HEIGHT } from "@/lib/constants"
import type { BookElement, TextContent, ImageContent } from "@/lib/types"

const USER_TEMPLATES_KEY = "digital-book-user-templates"

export interface UserTemplate {
  id: string
  name: string
  elements: BookElement[]
  leftBackgroundMediaId: string | null
  rightBackgroundMediaId: string | null
  fullSpreadBackgroundMediaId: string | null
  preview: { type: "text" | "image"; x: number; y: number; w: number; h: number }[]
  createdAt: string
}

export function getUserTemplates(): UserTemplate[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveUserTemplate(template: UserTemplate): void {
  const existing = getUserTemplates()
  existing.push(template)
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(existing))
}

export function deleteUserTemplate(id: string): void {
  const existing = getUserTemplates().filter((t) => t.id !== id)
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(existing))
}

export function buildPreviewFromElements(
  elements: BookElement[]
): { type: "text" | "image"; x: number; y: number; w: number; h: number }[] {
  return elements.map((el) => ({
    type: el.type === "text" ? "text" : "image",
    x: (el.x / CANVAS_WIDTH) * 100,
    y: (el.y / PAGE_HEIGHT) * 100,
    w: (el.width / CANVAS_WIDTH) * 100,
    h: (el.height / PAGE_HEIGHT) * 100,
  }))
}

function textElement(
  x: number,
  y: number,
  width: number,
  height: number,
  html: string,
  fontSize: number,
  zIndex: number,
  opts?: Partial<TextContent>
): BookElement {
  return {
    id: generateId(),
    type: "text",
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    locked: false,
    content: {
      html,
      fontFamily: "Inter",
      fontSize,
      color: "#ffffff",
      fontWeight: "400",
      alignment: "left",
      lineHeight: 1.4,
      letterSpacing: 0,
      opacity: 1,
      ...opts,
    } satisfies TextContent,
  }
}

function imageElement(
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): BookElement {
  return {
    id: generateId(),
    type: "image",
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    locked: false,
    content: {
      mediaId: "",
      objectFit: "cover",
    } satisfies ImageContent,
  }
}

export interface SpreadTemplate {
  id: string
  name: string
  description: string
  generate: () => BookElement[]
  // Preview layout: simple blocks representing element positions
  preview: { type: "text" | "image"; x: number; y: number; w: number; h: number }[]
}

export const SPREAD_TEMPLATES: SpreadTemplate[] = [
  {
    id: "title-spread",
    name: "Title Spread",
    description: "Centered title and subtitle",
    generate: () => [
      textElement(
        CANVAS_WIDTH / 2 - 400, 280, 800, 100,
        "Your Title Here",
        64, 0,
        { fontWeight: "700", alignment: "center" }
      ),
      textElement(
        CANVAS_WIDTH / 2 - 300, 400, 600, 60,
        "Subtitle or tagline goes here",
        24, 1,
        { alignment: "center", color: "#a1a1aa" }
      ),
    ],
    preview: [
      { type: "text", x: 15, y: 35, w: 70, h: 12 },
      { type: "text", x: 25, y: 52, w: 50, h: 8 },
    ],
  },
  {
    id: "two-column",
    name: "Two Column",
    description: "Text on both pages",
    generate: () => [
      // Left page
      textElement(60, 80, 600, 60, "Left Heading", 36, 0, { fontWeight: "700" }),
      textElement(60, 160, 600, 500, "Add your content here. This is the left page body text area.", 16, 1, { color: "#d4d4d8" }),
      // Right page
      textElement(PAGE_WIDTH + 60, 80, 600, 60, "Right Heading", 36, 2, { fontWeight: "700" }),
      textElement(PAGE_WIDTH + 60, 160, 600, 500, "Add your content here. This is the right page body text area.", 16, 3, { color: "#d4d4d8" }),
    ],
    preview: [
      { type: "text", x: 4, y: 10, w: 42, h: 8 },
      { type: "text", x: 4, y: 22, w: 42, h: 55 },
      { type: "text", x: 54, y: 10, w: 42, h: 8 },
      { type: "text", x: 54, y: 22, w: 42, h: 55 },
    ],
  },
  {
    id: "image-left-text-right",
    name: "Image + Text",
    description: "Image on left, text on right",
    generate: () => [
      // Left page: image
      imageElement(40, 40, PAGE_WIDTH - 80, PAGE_HEIGHT - 80, 0),
      // Right page: text
      textElement(PAGE_WIDTH + 60, 80, 600, 60, "Heading", 36, 1, { fontWeight: "700" }),
      textElement(PAGE_WIDTH + 60, 160, 600, 500, "Add your description or body text here.", 16, 2, { color: "#d4d4d8" }),
    ],
    preview: [
      { type: "image", x: 4, y: 6, w: 44, h: 88 },
      { type: "text", x: 54, y: 10, w: 42, h: 8 },
      { type: "text", x: 54, y: 22, w: 42, h: 55 },
    ],
  },
  {
    id: "text-left-image-right",
    name: "Text + Image",
    description: "Text on left, image on right",
    generate: () => [
      // Left page: text
      textElement(60, 80, 600, 60, "Heading", 36, 0, { fontWeight: "700" }),
      textElement(60, 160, 600, 500, "Add your description or body text here.", 16, 1, { color: "#d4d4d8" }),
      // Right page: image
      imageElement(PAGE_WIDTH + 40, 40, PAGE_WIDTH - 80, PAGE_HEIGHT - 80, 2),
    ],
    preview: [
      { type: "text", x: 4, y: 10, w: 42, h: 8 },
      { type: "text", x: 4, y: 22, w: 42, h: 55 },
      { type: "image", x: 52, y: 6, w: 44, h: 88 },
    ],
  },
  {
    id: "full-image-caption",
    name: "Full Image + Caption",
    description: "Full-spread image with caption",
    generate: () => [
      // Full spread image
      imageElement(0, 0, CANVAS_WIDTH, PAGE_HEIGHT, 0),
      // Caption overlay at bottom-right
      textElement(
        CANVAS_WIDTH - 400, PAGE_HEIGHT - 80, 360, 50,
        "Image caption or credit",
        14, 1,
        { alignment: "right", color: "#e4e4e7" }
      ),
    ],
    preview: [
      { type: "image", x: 2, y: 2, w: 96, h: 86 },
      { type: "text", x: 55, y: 82, w: 40, h: 8 },
    ],
  },
]
