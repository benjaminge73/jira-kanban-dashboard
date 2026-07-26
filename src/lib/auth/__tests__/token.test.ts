import { describe, expect, it } from "vitest"
import { createSessionToken, sessionCookieOptions, verifySessionToken } from "../token"

const SECRET = "hunter2"

describe("admin session token", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(SECRET, 60_000)
    expect(verifySessionToken(SECRET, token)).toBe(true)
  })

  it("rejects an expired token", () => {
    const now = Date.now()
    const token = createSessionToken(SECRET, 1000, now)
    expect(verifySessionToken(SECRET, token, now + 2000)).toBe(false)
  })

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("other-password", 60_000)
    expect(verifySessionToken(SECRET, token)).toBe(false)
  })

  it("rejects a tampered expiry", () => {
    const token = createSessionToken(SECRET, 1000, Date.now() - 5000) // already expired
    const [, sig] = token.split(".")
    const forged = `${Date.now() + 60_000}.${sig}`
    expect(verifySessionToken(SECRET, forged)).toBe(false)
  })

  it("rejects garbage", () => {
    expect(verifySessionToken(SECRET, "")).toBe(false)
    expect(verifySessionToken(SECRET, "abc")).toBe(false)
    expect(verifySessionToken(SECRET, ".only-sig")).toBe(false)
    expect(verifySessionToken(SECRET, "123456.")).toBe(false)
  })
})

describe("sessionCookieOptions", () => {
  it("is Secure in production", () => {
    expect(sessionCookieOptions(60_000, "production")).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
  })

  it("is not Secure outside production, so local HTTP dev keeps working", () => {
    expect(sessionCookieOptions(60_000, "development").secure).toBe(false)
    expect(sessionCookieOptions(60_000, "test").secure).toBe(false)
    expect(sessionCookieOptions(60_000, undefined).secure).toBe(false)
  })

  it("converts the TTL from milliseconds to seconds for maxAge", () => {
    expect(sessionCookieOptions(7 * 24 * 3600 * 1000, "production").maxAge).toBe(7 * 24 * 3600)
  })
})
