"use server"

import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_MS, isAdminProtectionEnabled } from "../auth/admin"
import { createSessionToken } from "../auth/token"

function passwordMatches(candidate: string, expected: string): boolean {
  // Constant-time comparison of variable-length strings via HMAC digests
  const key = "kanban-admin-login"
  const a = createHmac("sha256", key).update(candidate).digest()
  const b = createHmac("sha256", key).update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function loginAdmin(password: string): Promise<{ error?: string }> {
  if (!isAdminProtectionEnabled()) redirect("/admin/jh")

  if (!passwordMatches(password, process.env.ADMIN_PASSWORD!)) {
    return { error: "invalid" }
  }

  const token = createSessionToken(process.env.ADMIN_PASSWORD!, ADMIN_SESSION_TTL_MS)
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  })
  redirect("/admin/jh")
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE)
  redirect("/admin/login")
}
