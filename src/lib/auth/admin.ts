/**
 * Admin protection — active only when ADMIN_PASSWORD is set (any mode).
 * Without it the admin area stays open, as before; in live mode the header
 * shows a warning so operators know writes are unprotected.
 * Server-only: reads env and request cookies.
 */

import { cookies } from "next/headers"
import { verifySessionToken } from "./token"

export const ADMIN_COOKIE = "kanban_admin_session"
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 3600 * 1000

export function isAdminProtectionEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!isAdminProtectionEnabled()) return true
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) return false
  return verifySessionToken(process.env.ADMIN_PASSWORD!, token)
}
