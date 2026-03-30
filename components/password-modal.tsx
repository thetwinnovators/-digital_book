"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { hashPassword } from "@/lib/utils"
import type { Book } from "@/lib/types"

interface PasswordModalProps {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked: (book: Book) => void
}

export function PasswordModal({
  book,
  open,
  onOpenChange,
  onUnlocked,
}: PasswordModalProps) {
  const [inputValue, setInputValue] = useState("")
  const [shaking, setShaking] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state whenever the modal opens or closes
  useEffect(() => {
    setInputValue("")
    setShaking(false)
    setError(false)
    setLoading(false)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!book || loading) return

    setLoading(true)
    setError(false)

    const hash = await hashPassword(inputValue)

    if (hash === book.passwordHash) {
      sessionStorage.setItem("unlocked:" + book.id, "true")
      onUnlocked(book)
    } else {
      setLoading(false)
      setError(true)
      // Trigger shake animation then remove it after 300ms
      setShaking(true)
      setTimeout(() => setShaking(false), 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{book?.title ?? "Enter Password"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Input
              ref={inputRef}
              type="password"
              placeholder="Password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={shaking ? "animate-shake" : ""}
              autoComplete="current-password"
            />
            {error && (
              <p className="text-xs text-red-500">Incorrect password</p>
            )}
          </div>
          <Button type="submit" disabled={loading || inputValue.length === 0}>
            {loading ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
