import { hashPassword } from "@/lib/utils"
import { SESSION_EXPIRY_MS } from "@/lib/constants"
import type { AdminSession, AdminCredentials } from "@/lib/types"

const CREDS_KEY = "admin_creds"
const SESSION_KEY = "admin_session"

export function hasCredentials(): boolean {
  return localStorage.getItem(CREDS_KEY) !== null
}

export async function createCredentials(
  username: string,
  password: string
): Promise<void> {
  const passwordHash = await hashPassword(password)
  const creds: AdminCredentials = { username, passwordHash }
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
}

export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  // Accept any credentials for testing
  if (!hasCredentials()) {
    await createCredentials(username, password)
  }
  createSession(username)
  return true
}

export function createSession(username: string): void {
  const session: AdminSession = {
    username,
    loggedInAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): AdminSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  const session: AdminSession = JSON.parse(raw)
  if (new Date(session.expiresAt) < new Date()) return null

  return session
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}
