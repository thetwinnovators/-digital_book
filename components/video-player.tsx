"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"

interface VideoPlayerProps {
  src: string
  muted?: boolean
  loop?: boolean
  autoPlay?: boolean
  poster?: string
  className?: string
  interactive?: boolean
}

export default function VideoPlayer({
  src,
  muted = true,
  loop = false,
  autoPlay = false,
  poster,
  className = "",
  interactive = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showCover, setShowCover] = useState(!autoPlay)
  const [coverFrame, setCoverFrame] = useState<string | null>(null)

  // Generate a cover frame by seeking to 5s
  useEffect(() => {
    if (poster) return // use provided poster instead
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "metadata"
    video.muted = true
    video.src = src

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          setCoverFrame(canvas.toDataURL("image/jpeg", 0.8))
        }
      } catch {
        // cross-origin or other error — fall back to no cover
      }
      video.remove()
    }

    const handleLoaded = () => {
      // Seek to 5s or 25% of duration, whichever is smaller
      const seekTime = Math.min(5, video.duration * 0.25)
      video.currentTime = seekTime
    }

    video.addEventListener("loadedmetadata", handleLoaded)
    video.addEventListener("seeked", handleSeeked)
    video.load()

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded)
      video.removeEventListener("seeked", handleSeeked)
      video.remove()
    }
  }, [src, poster])

  const handlePlay = useCallback(() => {
    setShowCover(false)
    setTimeout(() => {
      videoRef.current?.play()
    }, 50)
  }, [])

  const handleVideoEnded = useCallback(() => {
    if (!loop) {
      setShowCover(true)
    }
  }, [loop])

  const coverImage = poster || coverFrame

  if (showCover) {
    return (
      <div
        className={`w-full h-full relative rounded bg-black overflow-hidden ${className}`}
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      >
        {coverImage && (
          <img
            src={coverImage}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {!coverImage && (
          <div className="w-full h-full bg-zinc-900" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Play button */}
        <button
          onClick={(e) => { e.stopPropagation(); handlePlay() }}
          className="absolute inset-0 flex items-center justify-center group"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
        </button>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      muted={muted}
      loop={loop}
      onEnded={handleVideoEnded}
      className={`w-full h-full object-cover rounded bg-black ${className}`}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
    />
  )
}
