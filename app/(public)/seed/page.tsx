"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveBook } from "@/lib/book-store"
import { saveMedia } from "@/lib/media-store"
import type { Book, Spread, BookElement, MediaRecord } from "@/lib/types"
import { Button } from "@/components/ui/button"

function generateId(): string {
  return crypto.randomUUID()
}

function generatePageLabels(spreadIndex: number): { left: string; right: string } {
  if (spreadIndex === 0) return { left: "Cover", right: "1" }
  return { left: String(spreadIndex * 2), right: String(spreadIndex * 2 + 1) }
}

async function createImageBlob(
  width: number,
  height: number,
  bgColor: string,
  lines: { text: string; y: number; size: number; color: string }[]
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  // Text
  for (const line of lines) {
    ctx.fillStyle = line.color
    ctx.font = `bold ${line.size}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(line.text, width / 2, line.y, width - 40)
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))
}

async function createGradientImageBlob(
  width: number,
  height: number,
  color1: string,
  color2: string,
  lines: { text: string; y: number; size: number; color: string }[]
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, color1)
  gradient.addColorStop(1, color2)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  for (const line of lines) {
    ctx.fillStyle = line.color
    ctx.font = `bold ${line.size}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(line.text, width / 2, line.y, width - 40)
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))
}

async function createIconImageBlob(
  width: number,
  height: number,
  bgColor: string,
  icon: string,
  caption: string
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  ctx.font = `${Math.min(width, height) * 0.4}px sans-serif`
  ctx.textAlign = "center"
  ctx.fillText(icon, width / 2, height * 0.5)

  if (caption) {
    ctx.fillStyle = "#ffffff"
    ctx.font = `bold ${Math.min(width, height) * 0.08}px sans-serif`
    ctx.fillText(caption, width / 2, height * 0.75, width - 20)
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"))
}

async function saveImageMedia(bookId: string, blob: Blob): Promise<string> {
  const id = generateId()
  const record: MediaRecord = {
    id,
    bookId,
    blob,
    mimeType: "image/png",
    createdAt: new Date().toISOString(),
  }
  await saveMedia(record)
  return id
}

function makeTextElement(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  html: string,
  fontSize: number = 24,
  color: string = "#ffffff",
  zIndex: number = 1
): BookElement {
  return {
    id,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    zIndex,
    locked: false,
    content: {
      html,
      fontFamily: "sans-serif",
      fontSize,
      color,
      fontWeight: "normal",
      alignment: "left",
      lineHeight: 1.4,
      letterSpacing: 0,
      opacity: 1,
    },
  }
}

function makeImageElement(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  mediaId: string,
  zIndex: number = 1
): BookElement {
  return {
    id,
    type: "image",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    zIndex,
    locked: false,
    content: {
      mediaId,
      objectFit: "cover" as const,
    },
  }
}

async function createAIBook(): Promise<void> {
  const bookId = generateId()
  const now = new Date().toISOString()

  // Cover image
  const coverBlob = await createGradientImageBlob(1440, 810, "#1a1a2e", "#16213e", [
    { text: "ARTIFICIAL", y: 300, size: 72, color: "#00d4ff" },
    { text: "INTELLIGENCE", y: 390, size: 72, color: "#00d4ff" },
    { text: "The Future of Technology", y: 480, size: 32, color: "#aaddff" },
  ])
  const coverMediaId = await saveImageMedia(bookId, coverBlob)

  // Page images
  const neuralNetBlob = await createIconImageBlob(400, 300, "#0d1b2a", "\u{1F9E0}", "Neural Networks")
  const neuralNetMediaId = await saveImageMedia(bookId, neuralNetBlob)

  const robotBlob = await createIconImageBlob(400, 300, "#1b2838", "\u{1F916}", "Machine Learning")
  const robotMediaId = await saveImageMedia(bookId, robotBlob)

  const chartBlob = await createIconImageBlob(400, 300, "#162447", "\u{1F4CA}", "Data Analytics")
  const chartMediaId = await saveImageMedia(bookId, chartBlob)

  const lightbulbBlob = await createIconImageBlob(400, 300, "#1a1a2e", "\u{1F4A1}", "Innovation")
  const lightbulbMediaId = await saveImageMedia(bookId, lightbulbBlob)

  const globeBlob = await createIconImageBlob(400, 300, "#0f3460", "\u{1F30D}", "Global Impact")
  const globeMediaId = await saveImageMedia(bookId, globeBlob)

  const rocketBlob = await createIconImageBlob(400, 300, "#1a1a2e", "\u{1F680}", "The Future")
  const rocketMediaId = await saveImageMedia(bookId, rocketBlob)

  // Spread backgrounds
  const spread1BgBlob = await createGradientImageBlob(1440, 810, "#0d1b2a", "#1b2838", [])
  const spread1BgId = await saveImageMedia(bookId, spread1BgBlob)

  const spread2BgBlob = await createGradientImageBlob(1440, 810, "#162447", "#1a1a2e", [])
  const spread2BgId = await saveImageMedia(bookId, spread2BgBlob)

  const spread3BgBlob = await createGradientImageBlob(1440, 810, "#1b2838", "#0f3460", [])
  const spread3BgId = await saveImageMedia(bookId, spread3BgBlob)

  const spreads: Spread[] = [
    // Spread 0: Cover
    {
      id: generateId(),
      spreadIndex: 0,
      leftPageLabel: "Cover",
      rightPageLabel: "1",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: coverMediaId,
      elements: [],
    },
    // Spread 1: What is AI?
    {
      id: generateId(),
      spreadIndex: 1,
      leftPageLabel: "2",
      rightPageLabel: "3",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread1BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>What is Artificial Intelligence?</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>Artificial Intelligence (AI) is the simulation of human intelligence by computer systems. It encompasses learning, reasoning, problem-solving, perception, and language understanding.</p><p>From virtual assistants to autonomous vehicles, AI is transforming every industry and reshaping how we live and work.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 160, 460, 400, 300, neuralNetMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>Key Concepts</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 760, 120, 640, 400,
          "<p><strong>Machine Learning:</strong> Systems that learn from data without explicit programming.</p><p><strong>Deep Learning:</strong> Neural networks with multiple layers that can discover intricate patterns.</p><p><strong>Natural Language Processing:</strong> Enabling machines to understand and generate human language.</p><p><strong>Computer Vision:</strong> Teaching machines to interpret visual information from the world.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 880, 460, 400, 300, robotMediaId, 2),
      ],
    },
    // Spread 2: Applications
    {
      id: generateId(),
      spreadIndex: 2,
      leftPageLabel: "4",
      rightPageLabel: "5",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread2BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>AI in Healthcare</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>AI is revolutionizing healthcare through early disease detection, drug discovery, and personalized treatment plans. Machine learning models can analyze medical images with accuracy matching or exceeding human specialists.</p><p>Predictive analytics help hospitals manage resources and anticipate patient needs before they become critical.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 160, 440, 400, 300, chartMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>AI in Business</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 760, 120, 640, 300,
          "<p>Businesses leverage AI for customer service automation, supply chain optimization, fraud detection, and market analysis. AI-powered analytics provide insights that drive strategic decisions.</p><p>From chatbots to recommendation engines, AI enhances customer experiences while reducing operational costs.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 880, 440, 400, 300, lightbulbMediaId, 2),
      ],
    },
    // Spread 3: Future
    {
      id: generateId(),
      spreadIndex: 3,
      leftPageLabel: "6",
      rightPageLabel: "7",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread3BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>Global Impact</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>AI is reshaping economies worldwide, creating new industries while transforming existing ones. Nations are investing heavily in AI research and development as part of their strategic growth plans.</p><p>Ethical AI development ensures technology serves humanity while addressing challenges like bias, privacy, and job displacement.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 160, 440, 400, 300, globeMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>The Road Ahead</h2>", 36, "#00d4ff"),
        makeTextElement(generateId(), 760, 120, 640, 300,
          "<p>The future of AI promises breakthroughs in general intelligence, quantum computing integration, and human-AI collaboration. As AI systems become more capable, they will tackle humanity's greatest challenges.</p><p>From climate change to space exploration, AI will be the catalyst for the next era of human achievement.</p>",
          20, "#ccddee"),
        makeImageElement(generateId(), 880, 440, 400, 300, rocketMediaId, 2),
      ],
    },
  ]

  const book: Book = {
    id: bookId,
    title: "Artificial Intelligence",
    slug: "artificial-intelligence",
    description: "Explore the world of AI — from neural networks to global impact.",
    status: "published",
    passwordHash: "",
    coverThumbnailMediaId: coverMediaId,
    spreads,
    searchText: [],
    createdAt: now,
    updatedAt: now,
  }

  await saveBook(book)
}

async function createDigitalTwinsBook(): Promise<void> {
  const bookId = generateId()
  const now = new Date().toISOString()

  // Cover image
  const coverBlob = await createGradientImageBlob(1440, 810, "#0a192f", "#20394f", [
    { text: "DIGITAL", y: 300, size: 72, color: "#64ffda" },
    { text: "TWINS", y: 390, size: 72, color: "#64ffda" },
    { text: "Bridging Physical & Virtual Worlds", y: 480, size: 32, color: "#a8e6cf" },
  ])
  const coverMediaId = await saveImageMedia(bookId, coverBlob)

  // Page images
  const factoryBlob = await createIconImageBlob(400, 300, "#0a192f", "\u{1F3ED}", "Smart Manufacturing")
  const factoryMediaId = await saveImageMedia(bookId, factoryBlob)

  const cityBlob = await createIconImageBlob(400, 300, "#112240", "\u{1F3D9}\uFE0F", "Smart Cities")
  const cityMediaId = await saveImageMedia(bookId, cityBlob)

  const heartBlob = await createIconImageBlob(400, 300, "#0a192f", "\u{1FA7A}", "Healthcare Twins")
  const heartMediaId = await saveImageMedia(bookId, heartBlob)

  const gearBlob = await createIconImageBlob(400, 300, "#112240", "\u2699\uFE0F", "IoT Integration")
  const gearMediaId = await saveImageMedia(bookId, gearBlob)

  const linkBlob = await createIconImageBlob(400, 300, "#0a192f", "\u{1F517}", "Connected Systems")
  const linkMediaId = await saveImageMedia(bookId, linkBlob)

  const crystalBlob = await createIconImageBlob(400, 300, "#112240", "\u{1F52E}", "Predictive Analytics")
  const crystalMediaId = await saveImageMedia(bookId, crystalBlob)

  // Spread backgrounds
  const spread1BgBlob = await createGradientImageBlob(1440, 810, "#0a192f", "#112240", [])
  const spread1BgId = await saveImageMedia(bookId, spread1BgBlob)

  const spread2BgBlob = await createGradientImageBlob(1440, 810, "#112240", "#1d3557", [])
  const spread2BgId = await saveImageMedia(bookId, spread2BgBlob)

  const spread3BgBlob = await createGradientImageBlob(1440, 810, "#1d3557", "#0a192f", [])
  const spread3BgId = await saveImageMedia(bookId, spread3BgBlob)

  const spreads: Spread[] = [
    // Spread 0: Cover
    {
      id: generateId(),
      spreadIndex: 0,
      leftPageLabel: "Cover",
      rightPageLabel: "1",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: coverMediaId,
      elements: [],
    },
    // Spread 1: What are Digital Twins?
    {
      id: generateId(),
      spreadIndex: 1,
      leftPageLabel: "2",
      rightPageLabel: "3",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread1BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>What Are Digital Twins?</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>A digital twin is a virtual replica of a physical object, process, or system. It uses real-time data and simulation to mirror its physical counterpart, enabling monitoring, analysis, and optimization.</p><p>From jet engines to entire cities, digital twins are transforming how we design, build, and maintain complex systems.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 160, 460, 400, 300, factoryMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>Core Technology</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 760, 120, 640, 400,
          "<p><strong>IoT Sensors:</strong> Capture real-time data from physical assets to feed the digital model.</p><p><strong>Cloud Computing:</strong> Provides the computational power for complex simulations and data processing.</p><p><strong>AI & Machine Learning:</strong> Enables predictive capabilities and autonomous optimization.</p><p><strong>3D Modeling:</strong> Creates visual representations that mirror physical objects with precision.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 880, 460, 400, 300, gearMediaId, 2),
      ],
    },
    // Spread 2: Applications
    {
      id: generateId(),
      spreadIndex: 2,
      leftPageLabel: "4",
      rightPageLabel: "5",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread2BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>Smart Cities</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>Urban digital twins model entire cities, simulating traffic flow, energy consumption, and infrastructure performance. City planners use these models to test scenarios before implementing changes.</p><p>Singapore's Virtual Singapore project is one of the most ambitious digital twin initiatives, modeling the entire city-state in 3D.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 160, 440, 400, 300, cityMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>Healthcare Applications</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 760, 120, 640, 300,
          "<p>Medical digital twins create virtual models of patients, organs, and biological processes. These models help clinicians test treatments virtually before applying them.</p><p>From heart simulations to drug interaction modeling, healthcare digital twins are paving the way for personalized medicine.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 880, 440, 400, 300, heartMediaId, 2),
      ],
    },
    // Spread 3: Future
    {
      id: generateId(),
      spreadIndex: 3,
      leftPageLabel: "6",
      rightPageLabel: "7",
      leftBackgroundMediaId: null,
      rightBackgroundMediaId: null,
      fullSpreadBackgroundMediaId: spread3BgId,
      elements: [
        makeTextElement(generateId(), 40, 40, 640, 60, "<h2>Connected Ecosystems</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 40, 120, 640, 300,
          "<p>The future of digital twins lies in interconnected ecosystems where multiple twins interact and share data. Supply chains, power grids, and transportation networks will operate as unified digital systems.</p><p>This convergence enables unprecedented visibility and control over complex global operations.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 160, 440, 400, 300, linkMediaId, 2),
        makeTextElement(generateId(), 760, 40, 640, 60, "<h2>Predictive Future</h2>", 36, "#64ffda"),
        makeTextElement(generateId(), 760, 120, 640, 300,
          "<p>As AI and computing power advance, digital twins will evolve from reactive monitoring tools to proactive prediction engines. They will anticipate failures, optimize performance, and drive autonomous decision-making.</p><p>The digital twin market is projected to grow exponentially, becoming an essential tool across every industry.</p>",
          20, "#ccd6f6"),
        makeImageElement(generateId(), 880, 440, 400, 300, crystalMediaId, 2),
      ],
    },
  ]

  const book: Book = {
    id: bookId,
    title: "Digital Twins",
    slug: "digital-twins",
    description: "Discover how digital twins bridge physical and virtual worlds.",
    status: "published",
    passwordHash: "",
    coverThumbnailMediaId: coverMediaId,
    spreads,
    searchText: [],
    createdAt: now,
    updatedAt: now,
  }

  await saveBook(book)
}

export default function SeedPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "seeding" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleSeed() {
    setStatus("seeding")
    setMessage("Creating demo books...")

    try {
      await createAIBook()
      setMessage("AI book created. Creating Digital Twins book...")
      await createDigitalTwinsBook()
      setStatus("done")
      setMessage("Both demo books created successfully!")
    } catch (err) {
      setStatus("error")
      setMessage("Error: " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-zinc-100">Seed Demo Books</h1>
        <p className="text-zinc-400 text-sm max-w-md">
          This will create two demo books: &ldquo;Artificial Intelligence&rdquo; and &ldquo;Digital Twins&rdquo;,
          each with a cover image and supporting images within the pages.
        </p>

        {status === "idle" && (
          <Button onClick={handleSeed} size="lg">
            Create Demo Books
          </Button>
        )}

        {status === "seeding" && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            <span className="text-sm">{message}</span>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-3">
            <p className="text-green-400 text-sm">{message}</p>
            <Button onClick={() => router.push("/")} size="lg">
              View Gallery
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{message}</p>
            <Button onClick={handleSeed} variant="outline">
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
