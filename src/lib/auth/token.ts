/**
 * Stateless admin session token: `${expiryMs}.${hmac}` where the HMAC is
 * keyed on ADMIN_PASSWORD. No session store needed; rotating the password
 * invalidates every session. Pure module (Node crypto only).
 */

import { createHmac, timingSafeEqual } from "crypto"

function sign(secret: string, expiryMs: number): string {
  return createHmac("sha256", secret).update(`admin-session|${expiryMs}`).digest("hex")
}

export function createSessionToken(secret: string, ttlMs: number, now = Date.now()): string {
  const expiryMs = now + ttlMs
  return `${expiryMs}.${sign(secret, expiryMs)}`
}

export function verifySessionToken(secret: string, token: string, now = Date.now()): boolean {
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const expiryMs = Number(token.slice(0, dot))
  if (!Number.isFinite(expiryMs) || expiryMs <= now) return false
  const provided = token.slice(dot + 1)
  const expected = sign(secret, expiryMs)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))
}
