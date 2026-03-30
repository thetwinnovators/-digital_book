"use client"

import { useCallback } from "react"
import { AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react"
import type { TextContent } from "@/lib/types"

interface ToolbarProps {
  content: TextContent
  onChange: (content: TextContent) => void
}

const FONT_FAMILIES = ["Inter", "Aptos", "Fort", "Georgia", "Courier New", "Arial", "Times New Roman"]

export default function Toolbar({ content, onChange }: ToolbarProps) {
  const update = useCallback(
    (key: keyof TextContent, value: string | number) => {
      onChange({ ...content, [key]: value })
    },
    [content, onChange]
  )

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-lg shadow-xl z-50 border border-zinc-700">
      {/* Font family */}
      <select
        value={content.fontFamily}
        onChange={(e) => update("fontFamily", e.target.value)}
        className="bg-zinc-800 text-zinc-200 text-xs rounded px-1.5 py-1 border border-zinc-700 outline-none max-w-[110px]"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      {/* Font size */}
      <input
        type="number"
        min={8}
        max={120}
        value={content.fontSize}
        onChange={(e) => update("fontSize", Number(e.target.value))}
        className="bg-zinc-800 text-zinc-200 text-xs rounded px-1.5 py-1 border border-zinc-700 outline-none w-14 text-center"
      />

      {/* Color */}
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={content.color}
          onChange={(e) => update("color", e.target.value)}
          className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent p-0"
        />
        <input
          type="text"
          value={content.color}
          onChange={(e) => {
            let v = e.target.value
            if (!v.startsWith("#")) v = "#" + v
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update("color", v)
          }}
          className="bg-zinc-800 text-zinc-200 text-xs rounded px-1.5 py-1 border border-zinc-700 outline-none w-[72px] font-mono"
          maxLength={7}
        />
      </div>

      {/* Bold toggle */}
      <button
        onClick={() => update("fontWeight", content.fontWeight === "700" ? "400" : "700")}
        className={`p-1 rounded transition-colors ${
          content.fontWeight === "700"
            ? "bg-blue-600 text-white"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        }`}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-zinc-700" />

      {/* Alignment */}
      {(["left", "center", "right"] as const).map((align) => {
        const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight
        return (
          <button
            key={align}
            onClick={() => update("alignment", align)}
            className={`p-1 rounded transition-colors ${
              content.alignment === align
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
            title={`Align ${align}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}

      {/* Divider */}
      <div className="w-px h-5 bg-zinc-700" />

      {/* Opacity */}
      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span>Op</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={content.opacity}
          onChange={(e) => update("opacity", Number(e.target.value))}
          className="w-16 accent-blue-500"
        />
      </label>
    </div>
  )
}
