"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"

interface AudioPlayerProps {
  src: string
  loop?: boolean
  autoPlay?: boolean
  interactive?: boolean
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function AudioPlayer({ src, loop, autoPlay, interactive = true }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [src])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(!muted)
  }, [muted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = v
      if (v > 0 && muted) {
        audioRef.current.muted = false
        setMuted(false)
      }
    }
  }, [muted])

  const seekTo = useCallback((clientX: number) => {
    const bar = progressRef.current
    const audio = audioRef.current
    if (!bar || !audio || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }, [duration])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    seekTo(e.clientX)

    const onMove = (ev: MouseEvent) => seekTo(ev.clientX)
    const onUp = () => {
      setDragging(false)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [seekTo])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="w-full h-full flex items-center rounded-xl px-3 gap-2"
      style={{
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      <audio ref={audioRef} src={src} loop={loop} autoPlay={autoPlay} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay() }}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
        style={{
          background: "rgba(255, 255, 255, 0.15)",
          color: "rgba(255, 255, 255, 0.9)",
        }}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {/* Time */}
      <span className="shrink-0 text-[10px] font-medium tabular-nums" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
        {formatTime(currentTime)}
      </span>

      {/* Progress bar */}
      <div
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        className="flex-1 h-1.5 rounded-full cursor-pointer relative"
        style={{ background: "rgba(255, 255, 255, 0.15)" }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-[width]"
          style={{
            width: `${progress}%`,
            background: "rgba(255, 255, 255, 0.7)",
            transitionDuration: dragging ? "0ms" : "100ms",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 hover:opacity-100 transition-opacity"
          style={{
            left: `calc(${progress}% - 6px)`,
            background: "rgba(255, 255, 255, 0.9)",
            boxShadow: "0 0 4px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Duration */}
      <span className="shrink-0 text-[10px] font-medium tabular-nums" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
        {formatTime(duration)}
      </span>

      {/* Volume */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleMute() }}
        className="shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
        style={{ color: "rgba(255, 255, 255, 0.7)" }}
      >
        {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={handleVolumeChange}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 w-14 h-1 accent-white/70 cursor-pointer"
        style={{ accentColor: "rgba(255, 255, 255, 0.7)" }}
      />
    </div>
  )
}
