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
} from "lucide-react"
import { isAuthenticated } from "@/lib/auth"
import { getBrochureById, saveBrochure } from "@/lib/brochure-store"
import { getMediaUrl, saveMedia, validateImageFile } from "@/lib/media-store"
import { generateId } from "@/lib/utils"
import { extractSearchText } from "@/lib/search"
import { AUTOSAVE_INTERVAL_MS } from "@/lib/constants"
import type { Brochure, BrochureElement, ImageContent, TextContent } from "@/lib/types"
import EditorCanvas from "@/components/editor/editor-canvas"
import Toolbar from "@/components/editor/toolbar"
import LayerPanel from "@/components/editor/layer-panel"
import { HistoryManager } from "@/components/editor/history"

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [brochure, setBrochure] = useState<Brochure | null>(null)
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  // Counter to force re-render after undo/redo
  const [, setRenderTick] = useState(0)
  const forceRender = useCallback(() => setRenderTick((t) => t + 1), [])

  const historyRef = useRef(new HistoryManager())
  const isDirtyRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved")

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

  // Load brochure
  useEffect(() => {
    if (!id) return
    getBrochureById(id).then((b) => {
      if (b) {
        setBrochure(b)
      } else {
        router.replace("/dashboard")
      }
    })
  }, [id, router])

  // Resolve all media IDs to object URLs
  useEffect(() => {
    if (!brochure) return

    const mediaIds = new Set<string>()
    for (const spread of brochure.spreads) {
      if (spread.fullSpreadBackgroundMediaId) mediaIds.add(spread.fullSpreadBackgroundMediaId)
      if (spread.leftBackgroundMediaId) mediaIds.add(spread.leftBackgroundMediaId)
      if (spread.rightBackgroundMediaId) mediaIds.add(spread.rightBackgroundMediaId)
      for (const el of spread.elements) {
        if (el.type === "image") {
          const content = el.content as ImageContent
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
  }, [brochure])

  // --- Save logic ---
  const performSave = useCallback(async () => {
    if (!brochure) return
    const now = new Date().toISOString()
    const searchText = extractSearchText(brochure)
    const firstSpread = brochure.spreads[0]
    const coverThumbnailMediaId =
      firstSpread?.fullSpreadBackgroundMediaId ||
      firstSpread?.leftBackgroundMediaId ||
      null
    const updated: Brochure = {
      ...brochure,
      searchText,
      updatedAt: now,
      coverThumbnailMediaId,
    }
    await saveBrochure(updated)
    setBrochure(updated)
    isDirtyRef.current = false
    setSaveStatus("saved")
  }, [brochure])

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
    (elementId: string, updates: Partial<BrochureElement>) => {
      setBrochure((prev) => {
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
            setBrochure((p) => {
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
            setBrochure((p) => {
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
      setBrochure((prev) => (prev ? { ...prev, title: newTitle } : prev))
      markDirty()
    },
    [markDirty]
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInsertText = useCallback(() => {
    setBrochure((prev) => {
      if (!prev) return prev
      const spreadIdx = currentSpreadIndex
      const spread = prev.spreads[spreadIdx]
      const newElement: BrochureElement = {
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
          setBrochure((p) => {
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
          setBrochure((p) => {
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
        brochureId: id,
        blob: file,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })

      // Create object URL for immediate display
      const url = URL.createObjectURL(file)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))

      setBrochure((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const spread = prev.spreads[spreadIdx]
        const newElement: BrochureElement = {
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
            setBrochure((p) => {
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
            setBrochure((p) => {
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
      setBrochure((prev) => {
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
            setBrochure((p) => {
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
            setBrochure((p) => {
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
      setBrochure((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const el = prev.spreads[spreadIdx]?.elements.find(
          (e) => e.id === elId
        )
        if (!el) return prev
        const wasLocked = el.locked

        historyRef.current.push({
          undo: () => {
            setBrochure((p) => {
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
            setBrochure((p) => {
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
      setBrochure((prev) => {
        if (!prev) return prev
        const spreadIdx = currentSpreadIndex
        const el = prev.spreads[spreadIdx]?.elements.find(
          (e) => e.id === elId
        )
        if (!el || el.locked) return prev
        const snapshot = { ...el }

        historyRef.current.push({
          undo: () => {
            setBrochure((p) => {
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
            setBrochure((p) => {
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
    if (!brochure || !selectedElementId) return
    const spreadIdx = currentSpreadIndex
    const spread = brochure.spreads[spreadIdx]
    const el = spread.elements.find((e) => e.id === selectedElementId)
    if (!el) return
    const newEl: BrochureElement = {
      ...el,
      id: generateId(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: el.zIndex + 1,
      content: { ...el.content },
    }

    historyRef.current.push({
      undo: () => {
        setBrochure((p) => {
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
        setBrochure((p) => {
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

    setBrochure((prev) => {
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
  }, [brochure, selectedElementId, currentSpreadIndex, markDirty, forceRender])

  // --- Object-fit selector for image elements ---
  const handleObjectFitChange = useCallback(
    (fit: "cover" | "contain" | "fill") => {
      if (!selectedElementId) return
      handleUpdateElement(selectedElementId, {
        content: { mediaId: "", objectFit: fit } as ImageContent,
      })
    },
    [selectedElementId, handleUpdateElement]
  )

  // We need a better approach for object-fit: update just the content field
  const handleImageObjectFit = useCallback(
    (fit: "cover" | "contain" | "fill") => {
      if (!brochure || !selectedElementId) return
      const spread = brochure.spreads[currentSpreadIndex]
      const el = spread.elements.find((e) => e.id === selectedElementId)
      if (!el || el.type !== "image") return
      const content = el.content as ImageContent
      handleUpdateElement(selectedElementId, {
        content: { ...content, objectFit: fit },
      })
    },
    [brochure, selectedElementId, currentSpreadIndex, handleUpdateElement]
  )

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

      // Ctrl+Z / Cmd+Z → undo
      if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault()
        historyRef.current.undo()
        forceRender()
        return
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z → redo
      if (mod && e.shiftKey && e.key === "z") {
        e.preventDefault()
        historyRef.current.redo()
        forceRender()
        return
      }
      // Delete / Backspace → delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault()
          handleDeleteElement(selectedElementId)
        }
        return
      }
      // Ctrl+D / Cmd+D → duplicate
      if (mod && e.key === "d") {
        e.preventDefault()
        handleDuplicate()
        return
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectedElementId, handleDeleteElement, handleDuplicate, forceRender])

  if (!brochure) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading editor...</p>
      </div>
    )
  }

  const currentSpread = brochure.spreads[currentSpreadIndex]
  const totalSpreads = brochure.spreads.length

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
          value={brochure.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="bg-transparent border-none outline-none text-zinc-100 text-sm font-medium px-2 py-1 rounded hover:bg-zinc-800 focus:bg-zinc-800 transition-colors min-w-0 flex-shrink"
        />

        <div className="flex-1" />

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

        {/* Save button */}
        <button
          onClick={performSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      {/* Formatting toolbar — shown when a text element is selected */}
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
        <div className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-2 shrink-0">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors w-full text-left">
            <Palette className="w-4 h-4" />
            Backgrounds
          </button>
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
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-24 border-t border-zinc-800 px-4 flex items-center shrink-0">
        <p className="text-xs text-zinc-500">Spreads</p>
      </div>
    </div>
  )
}
