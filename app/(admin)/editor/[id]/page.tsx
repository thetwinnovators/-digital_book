"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  Type,
  Image,
  Palette,
  Undo2,
  Redo2,
  Plus,
  X,
  Settings,
  Check,
  Video,
  Music,
  Share2,
  Eye,
  ChevronDown,
  LayoutTemplate,
  Trash2,
  PlusCircle,
} from "lucide-react"
import { isAuthenticated } from "@/lib/auth"
import { getBookById, saveBook, getIndex } from "@/lib/book-store"
import { getMediaUrl, saveMedia, validateImageFile, deleteMedia } from "@/lib/media-store"
import { generateId, generatePageLabels, slugify, hashPassword } from "@/lib/utils"
import { extractSearchText } from "@/lib/search"
import { AUTOSAVE_INTERVAL_MS } from "@/lib/constants"
import {
  SPREAD_TEMPLATES,
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  buildPreviewFromElements,
  type UserTemplate,
} from "@/lib/templates"
import type { Book, BookElement, ImageContent, VideoContent, AudioContent, Spread, TextContent } from "@/lib/types"
import EditorCanvas from "@/components/editor/editor-canvas"
import Toolbar from "@/components/editor/toolbar"
import LayerPanel from "@/components/editor/layer-panel"
import SpreadStrip from "@/components/editor/spread-strip"
import { HistoryManager } from "@/components/editor/history"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [book, setBook] = useState<Book | null>(null)
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  // Counter to force re-render after undo/redo
  const [, setRenderTick] = useState(0)
  const forceRender = useCallback(() => setRenderTick((t) => t + 1), [])

  const historyRef = useRef(new HistoryManager())
  const isDirtyRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved")

  // Backgrounds section open/close
  const [bgSectionOpen, setBgSectionOpen] = useState(false)
  // Templates section open/close
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false)
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([])
  const [addTemplateMode, setAddTemplateMode] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")

  // Load user templates
  useEffect(() => {
    setUserTemplates(getUserTemplates())
  }, [])

  // Video insert dialog state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")

  // Audio insert dialog state
  const [audioDialogOpen, setAudioDialogOpen] = useState(false)
  const [audioUrl, setAudioUrl] = useState("")

  // Save menu state
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  // Share popover state
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTitle, setSettingsTitle] = useState("")
  const [settingsSlug, setSettingsSlug] = useState("")
  const [settingsSlugManual, setSettingsSlugManual] = useState(false)
  const [settingsDescription, setSettingsDescription] = useState("")
  const [settingsPassword, setSettingsPassword] = useState("")
  const [settingsHasPassword, setSettingsHasPassword] = useState(false)
  const [settingsSlugError, setSettingsSlugError] = useState("")

  // Background file input refs
  const leftBgInputRef = useRef<HTMLInputElement>(null)
  const rightBgInputRef = useRef<HTMLInputElement>(null)
  const fullBgInputRef = useRef<HTMLInputElement>(null)

  const markDirty = useCallback(() => {
    isDirtyRef.current = true
    setSaveStatus("unsaved")
  }, [])

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in")
    }
  }, [router])

  // Load book
  useEffect(() => {
    if (!id) return
    getBookById(id).then((b) => {
      if (b) {
        setBook(b)
      } else {
        router.replace("/dashboard")
      }
    })
  }, [id, router])

  // Resolve all media IDs to object URLs
  useEffect(() => {
    if (!book) return

    const mediaIds = new Set<string>()
    for (const spread of book.spreads) {
      if (spread.fullSpreadBackgroundMediaId) mediaIds.add(spread.fullSpreadBackgroundMediaId)
      if (spread.leftBackgroundMediaId) mediaIds.add(spread.leftBackgroundMediaId)
      if (spread.rightBackgroundMediaId) mediaIds.add(spread.rightBackgroundMediaId)
      for (const el of spread.elements) {
        if (el.type === "image" || el.type === "video" || el.type === "audio") {
          const content = el.content as { mediaId: string }
          if (content.mediaId) mediaIds.add(content.mediaId)
        }
      }
    }

    let revoked = false
    const urls: Record<string, string> = {}

    async function resolveAll() {
      const entries = Array.from(mediaIds)
      const results = await Promise.all(
        entries.map(async (mid) => {
          const url = await getMediaUrl(mid)
          return [mid, url] as const
        })
      )
      if (revoked) return
      for (const [mid, url] of results) {
        if (url) urls[mid] = url
      }
      setMediaUrls(urls)
    }

    resolveAll()

    return () => {
      revoked = true
      for (const url of Object.values(urls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [book])

  // --- Save logic ---
  const performSave = useCallback(async (statusOverride?: "draft" | "published") => {
    if (!book) return
    const now = new Date().toISOString()
    const searchText = extractSearchText(book)
    const firstSpread = book.spreads[0]
    const firstImageElement = firstSpread?.elements.find(
      (el) => el.type === "image" && (el.content as ImageContent).mediaId
    )
    const coverThumbnailMediaId =
      firstSpread?.fullSpreadBackgroundMediaId ||
      firstSpread?.rightBackgroundMediaId ||
      firstSpread?.leftBackgroundMediaId ||
      (firstImageElement ? (firstImageElement.content as ImageContent).mediaId : null) ||
      null
    const updated: Book = {
      ...book,
      status: statusOverride ?? book.status,
      searchText,
      updatedAt: now,
      coverThumbnailMediaId,
    }
    await saveBook(updated)
    setBook(updated)
    isDirtyRef.current = false
    setSaveStatus("saved")
  }, [book])

  // Autosave interval
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirtyRef.current) {
        performSave()
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [performSave])

  // Beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  // --- Element mutation with history ---
  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<BookElement>) => {
      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const oldElement = prev.spreads[spreadIdx]?.elements.find(
          (el) => el.id === elementId
        )
        if (!oldElement) return prev

        const snapshot = { ...oldElement }
        const newElement = { ...oldElement, ...updates }

        historyRef.current.push({
          undo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((el) =>
                          el.id === elementId ? snapshot : el
                        ),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
          redo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((el) =>
                          el.id === elementId ? newElement : el
                        ),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
        })

        markDirty()
        const newSpreads = prev.spreads.map((spread, idx) => {
          if (idx !== spreadIdx) return spread
          return {
            ...spread,
            elements: spread.elements.map((el) =>
              el.id === elementId ? newElement : el
            ),
          }
        })
        return { ...prev, spreads: newSpreads }
      })
    },
    [currentSpreadIndex, markDirty, forceRender]
  )

  const handleSelectElement = useCallback((elId: string | null) => {
    setSelectedElementId(elId)
  }, [])

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setBook((prev) => (prev ? { ...prev, title: newTitle } : prev))
      markDirty()
    },
    [markDirty]
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleInsertText = useCallback(() => {
    setBook((prev) => {
      if (!prev) return prev
      const spreadIdx = currentSpreadIndex
      const spread = prev.spreads[spreadIdx]
      const newElement: BookElement = {
        id: generateId(),
        type: "text",
        x: 210,
        y: 300,
        width: 300,
        height: 100,
        rotation: 0,
        zIndex: spread.elements.length,
        locked: false,
        content: {
          html: "",
          fontFamily: "Inter",
          fontSize: 16,
          color: "#ffffff",
          fontWeight: "400",
          alignment: "left",
          lineHeight: 1.5,
          letterSpacing: 0,
          opacity: 1,
        } satisfies TextContent,
      }

      historyRef.current.push({
        undo: () => {
          setBook((p) => {
            if (!p) return p
            return {
              ...p,
              spreads: p.spreads.map((s, i) =>
                i !== spreadIdx
                  ? s
                  : {
                      ...s,
                      elements: s.elements.filter(
                        (el) => el.id !== newElement.id
                      ),
                    }
              ),
            }
          })
          setSelectedElementId(null)
          markDirty()
          forceRender()
        },
        redo: () => {
          setBook((p) => {
            if (!p) return p
            return {
              ...p,
              spreads: p.spreads.map((s, i) =>
                i !== spreadIdx
                  ? s
                  : { ...s, elements: [...s.elements, newElement] }
              ),
            }
          })
          setSelectedElementId(newElement.id)
          markDirty()
          forceRender()
        },
      })

      markDirty()
      const newSpreads = prev.spreads.map((s, idx) => {
        if (idx !== spreadIdx) return s
        return { ...s, elements: [...s.elements, newElement] }
      })
      setSelectedElementId(newElement.id)
      return { ...prev, spreads: newSpreads }
    })
  }, [currentSpreadIndex, markDirty, forceRender])

  const handleInsertImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      // Reset so the same file can be picked again
      e.target.value = ""

      const validation = validateImageFile(file)
      if (!validation.valid) {
        alert(validation.error)
        return
      }

      const mediaId = generateId()
      await saveMedia({
        id: mediaId,
        bookId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      // Create object URL for immediate display
      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        const newElement: BookElement = {
          id: generateId(),
          type: "image",
          x: 210,
          y: 300,
          width: 300,
          height: 200,
          rotation: 0,
          zIndex: spread.elements.length,
          locked: false,
          content: {
            mediaId,
            objectFit: "cover",
          } satisfies ImageContent,
        }

        historyRef.current.push({
          undo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.filter(
                          (el) => el.id !== newElement.id
                        ),
                      }
                ),
              }
            })
            setSelectedElementId(null)
            markDirty()
            forceRender()
          },
          redo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : { ...s, elements: [...s.elements, newElement] }
                ),
              }
            })
            setSelectedElementId(newElement.id)
            markDirty()
            forceRender()
          },
        })

        markDirty()
        const newSpreads = prev.spreads.map((s, idx) => {
          if (idx !== spreadIdx) return s
          return { ...s, elements: [...s.elements, newElement] }
        })
        setSelectedElementId(newElement.id)
        return { ...prev, spreads: newSpreads }
      })
    },
    [id, currentSpreadIndex, markDirty, forceRender]
  )

  const handleInsertVideo = useCallback(() => {
    setVideoUrl("")
    setVideoDialogOpen(true)
  }, [])

  const handleInsertVideoByUrl = useCallback(() => {
    if (!videoUrl.trim()) return
    setVideoDialogOpen(false)

    setBook((prev) => {
      if (!prev) return prev
      const spreadIdx = currentSpreadIndex
      const spread = prev.spreads[spreadIdx]
      const newElement: BookElement = {
        id: generateId(),
        type: "video",
        x: 210,
        y: 200,
        width: 400,
        height: 280,
        rotation: 0,
        zIndex: spread.elements.length,
        locked: false,
        content: {
          mediaId: "",
          url: videoUrl.trim(),
          autoplay: false,
          loop: false,
          muted: true,
          thumbnailMediaId: "",
          thumbnailUrl: "",
          showCaptions: false,
        } satisfies VideoContent,
      }

      markDirty()
      const newSpreads = prev.spreads.map((s, idx) => {
        if (idx !== spreadIdx) return s
        return { ...s, elements: [...s.elements, newElement] }
      })
      setSelectedElementId(newElement.id)
      return { ...prev, spreads: newSpreads }
    })
  }, [videoUrl, currentSpreadIndex, markDirty])

  const handleInsertVideoByUpload = useCallback(() => {
    setVideoDialogOpen(false)
    videoInputRef.current?.click()
  }, [])

  const handleVideoFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ""

      if (!file.type.startsWith("video/")) {
        alert("File must be a video.")
        return
      }

      const mediaId = generateId()
      await saveMedia({
        id: mediaId,
        bookId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        const newElement: BookElement = {
          id: generateId(),
          type: "video",
          x: 210,
          y: 200,
          width: 400,
          height: 280,
          rotation: 0,
          zIndex: spread.elements.length,
          locked: false,
          content: {
            mediaId,
            url: "",
            autoplay: false,
            loop: false,
            muted: true,
            thumbnailMediaId: "",
            thumbnailUrl: "",
            showCaptions: false,
          } satisfies VideoContent,
        }

        markDirty()
        const newSpreads = prev.spreads.map((s, idx) => {
          if (idx !== spreadIdx) return s
          return { ...s, elements: [...s.elements, newElement] }
        })
        setSelectedElementId(newElement.id)
        return { ...prev, spreads: newSpreads }
      })
    },
    [id, currentSpreadIndex, markDirty]
  )

  const handleInsertAudio = useCallback(() => {
    setAudioUrl("")
    setAudioDialogOpen(true)
  }, [])

  const handleInsertAudioByUrl = useCallback(() => {
    if (!audioUrl.trim()) return
    setAudioDialogOpen(false)

    setBook((prev) => {
      if (!prev) return prev
      const spreadIdx = currentSpreadIndex
      const spread = prev.spreads[spreadIdx]
      const newElement: BookElement = {
        id: generateId(),
        type: "audio",
        x: 210,
        y: 600,
        width: 300,
        height: 60,
        rotation: 0,
        zIndex: spread.elements.length,
        locked: false,
        content: {
          mediaId: "",
          url: audioUrl.trim(),
          autoplay: false,
          loop: false,
        } satisfies AudioContent,
      }

      markDirty()
      const newSpreads = prev.spreads.map((s, idx) => {
        if (idx !== spreadIdx) return s
        return { ...s, elements: [...s.elements, newElement] }
      })
      setSelectedElementId(newElement.id)
      return { ...prev, spreads: newSpreads }
    })
  }, [audioUrl, currentSpreadIndex, markDirty])

  const handleInsertAudioByUpload = useCallback(() => {
    setAudioDialogOpen(false)
    audioInputRef.current?.click()
  }, [])

  const handleAudioFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ""

      if (!file.type.startsWith("audio/")) {
        alert("File must be an audio file.")
        return
      }

      const mediaId = generateId()
      await saveMedia({
        id: mediaId,
        bookId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        const newElement: BookElement = {
          id: generateId(),
          type: "audio",
          x: 210,
          y: 600,
          width: 300,
          height: 60,
          rotation: 0,
          zIndex: spread.elements.length,
          locked: false,
          content: {
            mediaId,
            url: "",
            autoplay: false,
            loop: false,
          } satisfies AudioContent,
        }

        markDirty()
        const newSpreads = prev.spreads.map((s, idx) => {
          if (idx !== spreadIdx) return s
          return { ...s, elements: [...s.elements, newElement] }
        })
        setSelectedElementId(newElement.id)
        return { ...prev, spreads: newSpreads }
      })
    },
    [id, currentSpreadIndex, markDirty]
  )

  const handleToolbarChange = useCallback(
    (newContent: TextContent) => {
      if (!selectedElementId) return
      handleUpdateElement(selectedElementId, { content: newContent })
    },
    [selectedElementId, handleUpdateElement]
  )

  // --- Layer panel handlers ---
  const handleLayerReorder = useCallback(
    (elementId: string, direction: "up" | "down") => {
      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        const sorted = [...spread.elements].sort((a, b) => a.zIndex - b.zIndex)
        const idx = sorted.findIndex((el) => el.id === elementId)
        if (idx === -1) return prev

        const swapIdx = direction === "up" ? idx + 1 : idx - 1
        if (swapIdx < 0 || swapIdx >= sorted.length) return prev

        const targetEl = sorted[idx]
        const swapEl = sorted[swapIdx]
        const oldZA = targetEl.zIndex
        const oldZB = swapEl.zIndex

        historyRef.current.push({
          undo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((el) => {
                          if (el.id === targetEl.id)
                            return { ...el, zIndex: oldZA }
                          if (el.id === swapEl.id)
                            return { ...el, zIndex: oldZB }
                          return el
                        }),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
          redo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((el) => {
                          if (el.id === targetEl.id)
                            return { ...el, zIndex: oldZB }
                          if (el.id === swapEl.id)
                            return { ...el, zIndex: oldZA }
                          return el
                        }),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
        })

        markDirty()
        return {
          ...prev,
          spreads: prev.spreads.map((s, i) =>
            i !== spreadIdx
              ? s
              : {
                  ...s,
                  elements: s.elements.map((el) => {
                    if (el.id === targetEl.id) return { ...el, zIndex: oldZB }
                    if (el.id === swapEl.id) return { ...el, zIndex: oldZA }
                    return el
                  }),
                }
          ),
        }
      })
    },
    [currentSpreadIndex, markDirty, forceRender]
  )

  const handleToggleLock = useCallback(
    (elId: string) => {
      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const el = prev.spreads[spreadIdx]?.elements.find(
          (e) => e.id === elId
        )
        if (!el) return prev
        const wasLocked = el.locked

        historyRef.current.push({
          undo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((e) =>
                          e.id === elId ? { ...e, locked: wasLocked } : e
                        ),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
          redo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.map((e) =>
                          e.id === elId ? { ...e, locked: !wasLocked } : e
                        ),
                      }
                ),
              }
            })
            markDirty()
            forceRender()
          },
        })

        markDirty()
        return {
          ...prev,
          spreads: prev.spreads.map((s, i) =>
            i !== spreadIdx
              ? s
              : {
                  ...s,
                  elements: s.elements.map((e) =>
                    e.id === elId ? { ...e, locked: !wasLocked } : e
                  ),
                }
          ),
        }
      })
    },
    [currentSpreadIndex, markDirty, forceRender]
  )

  const handleDeleteElement = useCallback(
    (elId: string) => {
      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const el = prev.spreads[spreadIdx]?.elements.find(
          (e) => e.id === elId
        )
        if (!el || el.locked) return prev
        const snapshot = { ...el }

        historyRef.current.push({
          undo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : { ...s, elements: [...s.elements, snapshot] }
                ),
              }
            })
            setSelectedElementId(snapshot.id)
            markDirty()
            forceRender()
          },
          redo: () => {
            setBook((p) => {
              if (!p) return p
              return {
                ...p,
                spreads: p.spreads.map((s, i) =>
                  i !== spreadIdx
                    ? s
                    : {
                        ...s,
                        elements: s.elements.filter((e) => e.id !== elId),
                      }
                ),
              }
            })
            setSelectedElementId(null)
            markDirty()
            forceRender()
          },
        })

        markDirty()
        if (selectedElementId === elId) setSelectedElementId(null)
        return {
          ...prev,
          spreads: prev.spreads.map((s, i) =>
            i !== spreadIdx
              ? s
              : { ...s, elements: s.elements.filter((e) => e.id !== elId) }
          ),
        }
      })
    },
    [currentSpreadIndex, selectedElementId, markDirty, forceRender]
  )

  // --- Duplicate element ---
  const handleDuplicate = useCallback(() => {
    if (!book || !selectedElementId) return
    const spreadIdx = currentSpreadIndex
    const spread = book.spreads[spreadIdx]
    const el = spread.elements.find((e) => e.id === selectedElementId)
    if (!el) return
    const newEl: BookElement = {
      ...el,
      id: generateId(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: el.zIndex + 1,
      content: { ...el.content },
    }

    historyRef.current.push({
      undo: () => {
        setBook((p) => {
          if (!p) return p
          return {
            ...p,
            spreads: p.spreads.map((s, i) =>
              i !== spreadIdx
                ? s
                : {
                    ...s,
                    elements: s.elements.filter((e) => e.id !== newEl.id),
                  }
            ),
          }
        })
        setSelectedElementId(el.id)
        markDirty()
        forceRender()
      },
      redo: () => {
        setBook((p) => {
          if (!p) return p
          return {
            ...p,
            spreads: p.spreads.map((s, i) =>
              i !== spreadIdx
                ? s
                : { ...s, elements: [...s.elements, newEl] }
            ),
          }
        })
        setSelectedElementId(newEl.id)
        markDirty()
        forceRender()
      },
    })

    setBook((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        spreads: prev.spreads.map((s, i) =>
          i !== spreadIdx
            ? s
            : { ...s, elements: [...s.elements, newEl] }
        ),
      }
    })
    setSelectedElementId(newEl.id)
    markDirty()
  }, [book, selectedElementId, currentSpreadIndex, markDirty, forceRender])

  // --- Object-fit selector for image elements ---
  const handleImageObjectFit = useCallback(
    (fit: "cover" | "contain" | "fill") => {
      if (!book || !selectedElementId) return
      const spread = book.spreads[currentSpreadIndex]
      const el = spread.elements.find((e) => e.id === selectedElementId)
      if (!el || el.type !== "image") return
      const content = el.content as ImageContent
      handleUpdateElement(selectedElementId, {
        content: { ...content, objectFit: fit },
      })
    },
    [book, selectedElementId, currentSpreadIndex, handleUpdateElement]
  )

  // --- Spread management ---
  const handleAddSpread = useCallback(() => {
    setBook((prev) => {
      if (!prev) return prev
      const newIndex = prev.spreads.length
      const labels = generatePageLabels(newIndex)
      const newSpread: Spread = {
        id: generateId(),
        spreadIndex: newIndex,
        leftPageLabel: labels.left,
        rightPageLabel: labels.right,
        leftBackgroundMediaId: null,
        rightBackgroundMediaId: null,
        fullSpreadBackgroundMediaId: null,
        backgroundColor: "",
        elements: [],
      }
      // Regenerate all page labels
      const newSpreads = [...prev.spreads, newSpread].map((s, i) => {
        const l = generatePageLabels(i)
        return { ...s, spreadIndex: i, leftPageLabel: l.left, rightPageLabel: l.right }
      })
      markDirty()
      return { ...prev, spreads: newSpreads }
    })
  }, [markDirty])

  const handleRemoveSpread = useCallback(
    (index: number) => {
      if (index === 0) return // cannot remove cover
      if (!book) return
      const spread = book.spreads[index]
      if (spread.elements.length > 0) {
        if (!confirm("Delete this spread and its content?")) return
      }

      // Delete associated media
      const mediaToDelete: string[] = []
      if (spread.leftBackgroundMediaId) mediaToDelete.push(spread.leftBackgroundMediaId)
      if (spread.rightBackgroundMediaId) mediaToDelete.push(spread.rightBackgroundMediaId)
      if (spread.fullSpreadBackgroundMediaId) mediaToDelete.push(spread.fullSpreadBackgroundMediaId)
      for (const el of spread.elements) {
        if (el.type === "image") {
          const content = el.content as ImageContent
          if (content.mediaId) mediaToDelete.push(content.mediaId)
        }
      }
      for (const mid of mediaToDelete) {
        deleteMedia(mid)
      }

      setBook((prev) => {
        if (!prev) return prev
        const filtered = prev.spreads.filter((_, i) => i !== index)
        // Regenerate all page labels
        const newSpreads = filtered.map((s, i) => {
          const l = generatePageLabels(i)
          return { ...s, spreadIndex: i, leftPageLabel: l.left, rightPageLabel: l.right }
        })
        markDirty()
        return { ...prev, spreads: newSpreads }
      })

      // Adjust current index if needed
      setCurrentSpreadIndex((prev) => {
        if (prev >= index && prev > 0) return prev - 1
        return prev
      })
    },
    [book, markDirty]
  )

  const handleReorderSpread = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === 0 || toIndex === 0) return // cannot move cover
      setBook((prev) => {
        if (!prev) return prev
        const newSpreads = [...prev.spreads]
        const [moved] = newSpreads.splice(fromIndex, 1)
        newSpreads.splice(toIndex, 0, moved)
        // Regenerate page labels
        const relabeled = newSpreads.map((s, i) => {
          const l = generatePageLabels(i)
          return { ...s, spreadIndex: i, leftPageLabel: l.left, rightPageLabel: l.right }
        })
        markDirty()
        return { ...prev, spreads: relabeled }
      })
      setCurrentSpreadIndex(toIndex)
    },
    [markDirty]
  )

  // --- Background handlers ---
  const handleBackgroundUpload = useCallback(
    async (file: File, target: "left" | "right" | "full") => {
      const validation = validateImageFile(file)
      if (!validation.valid) {
        alert(validation.error)
        return
      }

      const mediaId = generateId()
      await saveMedia({
        id: mediaId,
        bookId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const newSpreads = prev.spreads.map((s, i) => {
          if (i !== spreadIdx) return s
          if (target === "full") {
            return {
              ...s,
              fullSpreadBackgroundMediaId: mediaId,
              leftBackgroundMediaId: null,
              rightBackgroundMediaId: null,
            }
          } else if (target === "left") {
            return {
              ...s,
              leftBackgroundMediaId: mediaId,
              fullSpreadBackgroundMediaId: null,
            }
          } else {
            return {
              ...s,
              rightBackgroundMediaId: mediaId,
              fullSpreadBackgroundMediaId: null,
            }
          }
        })
        markDirty()
        return { ...prev, spreads: newSpreads }
      })
    },
    [id, currentSpreadIndex, markDirty]
  )

  const handleRemoveBackground = useCallback(
    (target: "left" | "right" | "full") => {
      setBook((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        let mediaIdToRemove: string | null = null

        if (target === "full") mediaIdToRemove = spread.fullSpreadBackgroundMediaId
        else if (target === "left") mediaIdToRemove = spread.leftBackgroundMediaId
        else mediaIdToRemove = spread.rightBackgroundMediaId

        if (mediaIdToRemove) deleteMedia(mediaIdToRemove)

        const newSpreads = prev.spreads.map((s, i) => {
          if (i !== spreadIdx) return s
          if (target === "full") return { ...s, fullSpreadBackgroundMediaId: null }
          if (target === "left") return { ...s, leftBackgroundMediaId: null }
          return { ...s, rightBackgroundMediaId: null }
        })
        markDirty()
        return { ...prev, spreads: newSpreads }
      })
    },
    [currentSpreadIndex, markDirty]
  )

  // --- Settings dialog ---
  const openSettings = useCallback(() => {
    if (!book) return
    setSettingsTitle(book.title)
    setSettingsSlug(book.slug)
    setSettingsSlugManual(false)
    setSettingsDescription(book.description)
    setSettingsPassword("")
    setSettingsHasPassword(!!book.passwordHash)
    setSettingsSlugError("")
    setSettingsOpen(true)
  }, [book])

  const handleSettingsTitleChange = useCallback(
    (val: string) => {
      setSettingsTitle(val)
      if (!settingsSlugManual) {
        setSettingsSlug(slugify(val) + "-" + id.slice(0, 8))
      }
    },
    [settingsSlugManual, id]
  )

  const handleSettingsSlugChange = useCallback((val: string) => {
    setSettingsSlugManual(true)
    setSettingsSlug(val)
    setSettingsSlugError("")
  }, [])

  const handleSetPassword = useCallback(async () => {
    if (!settingsPassword) return
    const hash = await hashPassword(settingsPassword)
    setBook((prev) => (prev ? { ...prev, passwordHash: hash } : prev))
    setSettingsHasPassword(true)
    setSettingsPassword("")
    markDirty()
  }, [settingsPassword, markDirty])

  const handleSaveSettings = useCallback(async () => {
    if (!book) return

    // Check slug uniqueness
    const index = getIndex()
    const duplicate = index.find((b) => b.slug === settingsSlug && b.id !== book.id)
    if (duplicate) {
      setSettingsSlugError("This URL is already in use")
      return
    }

    setBook((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        title: settingsTitle,
        slug: settingsSlug,
        description: settingsDescription,
      }
    })
    markDirty()
    setSettingsOpen(false)
  }, [book, settingsTitle, settingsSlug, settingsDescription, markDirty])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      // Don't intercept when typing in inputs
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+Z / Cmd+Z -> undo
      if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault()
        historyRef.current.undo()
        forceRender()
        return
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z -> redo
      if (mod && e.shiftKey && e.key === "z") {
        e.preventDefault()
        historyRef.current.redo()
        forceRender()
        return
      }
      // Delete / Backspace -> delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault()
          handleDeleteElement(selectedElementId)
        }
        return
      }
      // Ctrl+D / Cmd+D -> duplicate
      if (mod && e.key === "d") {
        e.preventDefault()
        handleDuplicate()
        return
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectedElementId, handleDeleteElement, handleDuplicate, forceRender])

  if (!book) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading editor...</p>
      </div>
    )
  }

  const currentSpread = book.spreads[currentSpreadIndex]
  const totalSpreads = book.spreads.length

  const selectedElement = selectedElementId
    ? currentSpread.elements.find((el) => el.id === selectedElementId) ?? null
    : null

  // Spread label: first spread is "Cover", rest are "Pages N-M"
  let spreadLabel: string
  if (currentSpreadIndex === 0) {
    spreadLabel = "Cover"
  } else {
    const leftPage = currentSpreadIndex * 2
    const rightPage = leftPage + 1
    spreadLabel = `Pages ${leftPage}-${rightPage}`
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center gap-4 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        <div className="w-px h-6 bg-zinc-800" />

        <input
          type="text"
          value={book.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="bg-transparent border-none outline-none text-zinc-100 text-sm font-medium px-2 py-1 rounded hover:bg-zinc-800 focus:bg-zinc-800 transition-colors min-w-0 flex-shrink"
        />

        <div className="flex-1" />

        {/* Settings button */}
        <button
          onClick={openSettings}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Book Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Undo / Redo */}
        <button
          onClick={() => {
            historyRef.current.undo()
            forceRender()
          }}
          disabled={!historyRef.current.canUndo}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            historyRef.current.redo()
            forceRender()
          }}
          disabled={!historyRef.current.canRedo}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Spread navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSpreadIndex((i) => Math.max(0, i - 1))}
            disabled={currentSpreadIndex === 0}
            className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-400 min-w-[80px] text-center">
            {spreadLabel}
          </span>
          <button
            onClick={() => setCurrentSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1))}
            disabled={currentSpreadIndex === totalSpreads - 1}
            className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Save status */}
        <span className="text-xs text-zinc-500">
          {saveStatus === "saved" ? "Saved" : "Unsaved changes"}
        </span>

        {/* Preview button */}
        <button
          onClick={() => window.open(`/books/${book.slug}`, "_blank")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
          title="Preview book"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>

        {/* Share button */}
        <div className="relative">
          <button
            onClick={() => { setSharePopoverOpen((o) => !o); setShareCopied(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
            title="Share link"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          {sharePopoverOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSharePopoverOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-md p-3 min-w-[340px]">
                <p className="text-xs text-zinc-400 mb-2">Share this book</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/books/${book.slug}`}
                    className="flex-1 bg-zinc-900 text-zinc-200 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none select-all"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/books/${book.slug}`
                      navigator.clipboard.writeText(url).then(() => {
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 2000)
                      })
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors whitespace-nowrap"
                  >
                    {shareCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save split button */}
        <div className="relative flex">
          <button
            onClick={() => performSave()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-l text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={() => setSaveMenuOpen((o) => !o)}
            className="flex items-center px-1.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-r border-l border-blue-500 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {saveMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-md py-1 min-w-[180px]">
                <button
                  onClick={() => { performSave("published"); setSaveMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Save &amp; Publish
                </button>
                <button
                  onClick={() => { performSave("draft"); setSaveMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Save as Draft
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Formatting toolbar -- shown when a text element is selected */}
      {selectedElement && selectedElement.type === "text" && (
        <div className="flex justify-center py-1 bg-zinc-950 border-b border-zinc-800 shrink-0">
          <Toolbar
            content={selectedElement.content as TextContent}
            onChange={handleToolbarChange}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-2 shrink-0 overflow-y-auto">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Tools</p>
          <button
            onClick={handleInsertText}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Type className="w-4 h-4" />
            Insert Text
          </button>
          <button
            onClick={handleInsertImage}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Image className="w-4 h-4" />
            Insert Image
          </button>
          <button
            onClick={handleInsertVideo}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Video className="w-4 h-4" />
            Insert Video
          </button>
          <button
            onClick={handleInsertAudio}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Music className="w-4 h-4" />
            Insert Audio
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoFileChange}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioFileChange}
            className="hidden"
          />

          {/* Backgrounds section */}
          <button
            onClick={() => setBgSectionOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <Palette className="w-4 h-4" />
            Backgrounds
          </button>

          {bgSectionOpen && (
            <div className="pl-2 flex flex-col gap-2">
              {/* Left Page BG */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => leftBgInputRef.current?.click()}
                  className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded px-2 py-1 flex-1 text-left truncate"
                >
                  {currentSpread.leftBackgroundMediaId ? "Left BG Set" : "Left Page BG"}
                </button>
                {currentSpread.leftBackgroundMediaId && (
                  <button
                    onClick={() => handleRemoveBackground("left")}
                    className="p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                ref={leftBgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleBackgroundUpload(f, "left")
                  e.target.value = ""
                }}
              />

              {/* Right Page BG */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => rightBgInputRef.current?.click()}
                  className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded px-2 py-1 flex-1 text-left truncate"
                >
                  {currentSpread.rightBackgroundMediaId ? "Right BG Set" : "Right Page BG"}
                </button>
                {currentSpread.rightBackgroundMediaId && (
                  <button
                    onClick={() => handleRemoveBackground("right")}
                    className="p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                ref={rightBgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleBackgroundUpload(f, "right")
                  e.target.value = ""
                }}
              />

              {/* Full Spread BG */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fullBgInputRef.current?.click()}
                  className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded px-2 py-1 flex-1 text-left truncate"
                >
                  {currentSpread.fullSpreadBackgroundMediaId ? "Full BG Set" : "Full Spread BG"}
                </button>
                {currentSpread.fullSpreadBackgroundMediaId && (
                  <button
                    onClick={() => handleRemoveBackground("full")}
                    className="p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                ref={fullBgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleBackgroundUpload(f, "full")
                  e.target.value = ""
                }}
              />

              {/* Background Color */}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentSpread.backgroundColor || "#27272a"}
                  onChange={(e) => {
                    setBook((prev) => {
                      if (!prev) return prev
                      markDirty()
                      return {
                        ...prev,
                        spreads: prev.spreads.map((s, i) =>
                          i !== currentSpreadIndex ? s : { ...s, backgroundColor: e.target.value }
                        ),
                      }
                    })
                  }}
                  className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={currentSpread.backgroundColor || ""}
                  placeholder="#27272a"
                  onChange={(e) => {
                    let v = e.target.value
                    if (v && !v.startsWith("#")) v = "#" + v
                    if (!v || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setBook((prev) => {
                        if (!prev) return prev
                        markDirty()
                        return {
                          ...prev,
                          spreads: prev.spreads.map((s, i) =>
                            i !== currentSpreadIndex ? s : { ...s, backgroundColor: v }
                          ),
                        }
                      })
                    }
                  }}
                  className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none w-[72px] font-mono"
                  maxLength={7}
                />
                <span className="text-xs text-zinc-500">BG Color</span>
                {currentSpread.backgroundColor && (
                  <button
                    onClick={() => {
                      setBook((prev) => {
                        if (!prev) return prev
                        markDirty()
                        return {
                          ...prev,
                          spreads: prev.spreads.map((s, i) =>
                            i !== currentSpreadIndex ? s : { ...s, backgroundColor: "" }
                          ),
                        }
                      })
                    }}
                    className="p-0.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Templates section */}
          <button
            onClick={() => setTemplateSectionOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left"
          >
            <LayoutTemplate className="w-4 h-4" />
            Templates
          </button>

          {templateSectionOpen && (
            <div className="pl-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
              {SPREAD_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    if (
                      currentSpread.elements.length > 0 &&
                      !confirm("Replace current spread elements with this template?")
                    ) return

                    setBook((prev) => {
                      if (!prev) return prev
                      const newElements = tpl.generate()
                      markDirty()
                      return {
                        ...prev,
                        spreads: prev.spreads.map((s, i) =>
                          i !== currentSpreadIndex
                            ? s
                            : { ...s, elements: newElements }
                        ),
                      }
                    })
                    setSelectedElementId(null)
                  }}
                  className="flex flex-col items-center gap-1 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                  title={tpl.description}
                >
                  {/* Mini preview */}
                  <div className="w-full aspect-[16/9] bg-zinc-700 rounded relative overflow-hidden">
                    {tpl.preview.map((block, bi) => (
                      <div
                        key={bi}
                        className={block.type === "image" ? "bg-zinc-500" : "bg-zinc-400"}
                        style={{
                          position: "absolute",
                          left: `${block.x}%`,
                          top: `${block.y}%`,
                          width: `${block.w}%`,
                          height: `${block.h}%`,
                          borderRadius: 1,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-zinc-400 leading-tight text-center">
                    {tpl.name}
                  </span>
                </button>
              ))}
              </div>
              {currentSpread.elements.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      if (!confirm("Remove all elements from this spread?")) return
                      setBook((prev) => {
                        if (!prev) return prev
                        markDirty()
                        return {
                          ...prev,
                          spreads: prev.spreads.map((s, i) =>
                            i !== currentSpreadIndex ? s : { ...s, elements: [] }
                          ),
                        }
                      })
                      setSelectedElementId(null)
                    }}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded px-2 py-1.5 transition-colors text-left"
                  >
                    Clear All Elements
                  </button>
                  {!addTemplateMode ? (
                    <button
                      onClick={() => { setAddTemplateMode(true); setNewTemplateName("") }}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded px-2 py-1.5 transition-colors text-left"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Add to Templates
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Template name"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTemplateName.trim()) {
                            const tpl: UserTemplate = {
                              id: generateId(),
                              name: newTemplateName.trim(),
                              elements: JSON.parse(JSON.stringify(currentSpread.elements)),
                              leftBackgroundMediaId: currentSpread.leftBackgroundMediaId,
                              rightBackgroundMediaId: currentSpread.rightBackgroundMediaId,
                              fullSpreadBackgroundMediaId: currentSpread.fullSpreadBackgroundMediaId,
                              preview: buildPreviewFromElements(currentSpread.elements),
                              createdAt: new Date().toISOString(),
                            }
                            saveUserTemplate(tpl)
                            setUserTemplates(getUserTemplates())
                            setAddTemplateMode(false)
                            setNewTemplateName("")
                          }
                          if (e.key === "Escape") setAddTemplateMode(false)
                        }}
                        autoFocus
                        className="flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none focus:border-blue-500 min-w-0"
                      />
                      <button
                        onClick={() => {
                          if (!newTemplateName.trim()) return
                          const tpl: UserTemplate = {
                            id: generateId(),
                            name: newTemplateName.trim(),
                            elements: JSON.parse(JSON.stringify(currentSpread.elements)),
                            leftBackgroundMediaId: currentSpread.leftBackgroundMediaId,
                            rightBackgroundMediaId: currentSpread.rightBackgroundMediaId,
                            fullSpreadBackgroundMediaId: currentSpread.fullSpreadBackgroundMediaId,
                            preview: buildPreviewFromElements(currentSpread.elements),
                            createdAt: new Date().toISOString(),
                          }
                          saveUserTemplate(tpl)
                          setUserTemplates(getUserTemplates())
                          setAddTemplateMode(false)
                          setNewTemplateName("")
                        }}
                        disabled={!newTemplateName.trim()}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setAddTemplateMode(false)}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* User-created templates */}
              {userTemplates.length > 0 && (
                <>
                  <div className="h-px bg-zinc-700 my-1" />
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider px-1">My Templates</p>
                  <div className="grid grid-cols-2 gap-2">
                    {userTemplates.map((tpl) => (
                      <div key={tpl.id} className="relative group">
                        <button
                          onClick={() => {
                            if (
                              currentSpread.elements.length > 0 &&
                              !confirm("Replace current spread elements with this template?")
                            ) return
                            // Deep clone elements with new IDs
                            const newElements = JSON.parse(JSON.stringify(tpl.elements)).map((el: BookElement) => ({
                              ...el,
                              id: generateId(),
                            }))
                            setBook((prev) => {
                              if (!prev) return prev
                              markDirty()
                              return {
                                ...prev,
                                spreads: prev.spreads.map((s, i) =>
                                  i !== currentSpreadIndex ? s : {
                                    ...s,
                                    elements: newElements,
                                    leftBackgroundMediaId: tpl.leftBackgroundMediaId ?? s.leftBackgroundMediaId,
                                    rightBackgroundMediaId: tpl.rightBackgroundMediaId ?? s.rightBackgroundMediaId,
                                    fullSpreadBackgroundMediaId: tpl.fullSpreadBackgroundMediaId ?? s.fullSpreadBackgroundMediaId,
                                  }
                                ),
                              }
                            })
                            setSelectedElementId(null)
                          }}
                          className="flex flex-col items-center gap-1 p-1.5 rounded hover:bg-zinc-800 transition-colors w-full"
                          title={tpl.name}
                        >
                          <div className="w-full aspect-[16/9] bg-zinc-700 rounded relative overflow-hidden">
                            {tpl.preview.map((block, bi) => (
                              <div
                                key={bi}
                                className={block.type === "image" ? "bg-zinc-500" : "bg-zinc-400"}
                                style={{
                                  position: "absolute",
                                  left: `${block.x}%`,
                                  top: `${block.y}%`,
                                  width: `${block.w}%`,
                                  height: `${block.h}%`,
                                  borderRadius: 1,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-zinc-400 leading-tight text-center truncate w-full">
                            {tpl.name}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!confirm(`Delete template "${tpl.name}"?`)) return
                            deleteUserTemplate(tpl.id)
                            setUserTemplates(getUserTemplates())
                          }}
                          className="absolute top-1 right-1 p-0.5 rounded bg-zinc-900/80 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete template"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Center canvas */}
        {currentSpread && (
          <EditorCanvas
            spread={currentSpread}
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            mediaUrls={mediaUrls}
          />
        )}

        {/* Right sidebar */}
        <div className="w-56 border-l border-zinc-800 p-4 shrink-0 overflow-y-auto">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Layers</p>
          <LayerPanel
            elements={currentSpread.elements}
            selectedId={selectedElementId}
            onSelect={handleSelectElement}
            onReorder={handleLayerReorder}
            onToggleLock={handleToggleLock}
            onDelete={handleDeleteElement}
          />

          {/* Object-fit selector for image elements */}
          {selectedElement && selectedElement.type === "image" && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Image Fit
              </p>
              <select
                value={(selectedElement.content as ImageContent).objectFit}
                onChange={(e) =>
                  handleImageObjectFit(
                    e.target.value as "cover" | "contain" | "fill"
                  )
                }
                className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none focus:border-zinc-500"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </div>
          )}

          {/* Video settings */}
          {selectedElement && selectedElement.type === "video" && (() => {
            const vc = selectedElement.content as VideoContent
            return (
              <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Video Settings</p>

                {/* Autoplay */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Auto Play</span>
                  <input type="checkbox" checked={vc.autoplay} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...vc, autoplay: e.target.checked } })} className="accent-blue-500" />
                </label>

                {/* Loop */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Loop</span>
                  <input type="checkbox" checked={vc.loop} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...vc, loop: e.target.checked } })} className="accent-blue-500" />
                </label>

                {/* Muted */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Muted</span>
                  <input type="checkbox" checked={vc.muted} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...vc, muted: e.target.checked } })} className="accent-blue-500" />
                </label>

                {/* Show Captions */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Captions / Subtitles</span>
                  <input type="checkbox" checked={vc.showCaptions} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...vc, showCaptions: e.target.checked } })} className="accent-blue-500" />
                </label>

                {/* Thumbnail */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400">Thumbnail</span>
                  <input
                    type="url"
                    placeholder="Thumbnail URL"
                    value={vc.thumbnailUrl || ""}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...vc, thumbnailUrl: e.target.value } })}
                    className="bg-zinc-800 text-zinc-100 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )
          })()}

          {/* Audio settings */}
          {selectedElement && selectedElement.type === "audio" && (() => {
            const ac = selectedElement.content as AudioContent
            return (
              <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Audio Settings</p>

                {/* Autoplay */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Auto Play</span>
                  <input type="checkbox" checked={ac.autoplay} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...ac, autoplay: e.target.checked } })} className="accent-blue-500" />
                </label>

                {/* Loop */}
                <label className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Loop</span>
                  <input type="checkbox" checked={ac.loop} onChange={(e) => handleUpdateElement(selectedElement.id, { content: { ...ac, loop: e.target.checked } })} className="accent-blue-500" />
                </label>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Bottom bar — Spread Strip */}
      <div className="border-t border-zinc-800 shrink-0">
        <SpreadStrip
          spreads={book.spreads}
          currentIndex={currentSpreadIndex}
          onSelect={setCurrentSpreadIndex}
          onAdd={handleAddSpread}
          onRemove={handleRemoveSpread}
          onReorder={handleReorderSpread}
          mediaUrls={mediaUrls}
        />
      </div>

      {/* Video Insert Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 text-zinc-100 border border-zinc-700">
          <DialogHeader>
            <DialogTitle>Insert Video</DialogTitle>
            <DialogDescription>Paste a video URL or upload a file.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Video URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 border border-zinc-700 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleInsertVideoByUrl}
                  disabled={!videoUrl.trim()}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Insert
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-700" />
              <span className="text-xs text-zinc-500">or</span>
              <div className="flex-1 h-px bg-zinc-700" />
            </div>
            <button
              onClick={handleInsertVideoByUpload}
              className="w-full px-3 py-2 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
            >
              Upload Video File
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audio Insert Dialog */}
      <Dialog open={audioDialogOpen} onOpenChange={setAudioDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 text-zinc-100 border border-zinc-700">
          <DialogHeader>
            <DialogTitle>Insert Audio</DialogTitle>
            <DialogDescription>Paste an audio URL or upload a file.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Audio URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/audio.mp3"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 border border-zinc-700 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleInsertAudioByUrl}
                  disabled={!audioUrl.trim()}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Insert
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-700" />
              <span className="text-xs text-zinc-500">or</span>
              <div className="flex-1 h-px bg-zinc-700" />
            </div>
            <button
              onClick={handleInsertAudioByUpload}
              className="w-full px-3 py-2 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
            >
              Upload Audio File
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 text-zinc-100 border border-zinc-700">
          <DialogHeader>
            <DialogTitle>Book Settings</DialogTitle>
            <DialogDescription>
              Configure title, URL, password and description.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Title</label>
              <input
                type="text"
                value={settingsTitle}
                onChange={(e) => handleSettingsTitleChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">URL Slug</label>
              <input
                type="text"
                value={settingsSlug}
                onChange={(e) => handleSettingsSlugChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              />
              <p className="text-[10px] text-zinc-500">/books/{settingsSlug}</p>
              {settingsSlugError && (
                <p className="text-[10px] text-red-400">{settingsSlugError}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                Password
                {settingsHasPassword && <Check className="w-3 h-3 text-green-400" />}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  placeholder={settingsHasPassword ? "Change password..." : "Set a password..."}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
                <button
                  onClick={handleSetPassword}
                  disabled={!settingsPassword}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded text-xs text-zinc-200 transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Description</label>
              <textarea
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                rows={3}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
            >
              Save Settings
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
