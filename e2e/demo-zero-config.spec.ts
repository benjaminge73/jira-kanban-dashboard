import { test, expect } from "@playwright/test"

/**
 * The written invariant this repo exists to keep true (CLAUDE.md,
 * "Invariants"): "Demo mode must stay zero-config and byte-identical" — it
 * "must keep working with no environment variables at all". This spec makes
 * that invariant executable instead of merely asserted in prose.
 *
 * Run with NO .env, NO JIRA_*, nothing — same as the CI job that runs this
 * spec (see ci.yml's `e2e` job: deliberately no business `env:` on the
 * smoke step, the opposite of the usual reflex, because the whole point is
 * that this must pass without being handed anything).
 *
 * Assertion: the three deterministic demo brand names (GOOG/AAPL/MSFT —
 * src/lib/mock-data/brands.ts, ~420 tickets, 2026 only) are VISIBLE on each
 * of the three public routes, once the page has hydrated. Several
 * independent pieces of UI draw brand names from the same `getUiMeta()`
 * brand list (velocity legend, budget legend, aging-WIP legend, quality
 * brand-breakdown axis, ...) and which one is populated can shift with the
 * data. Asserting "is this text visible anywhere on the page" rather than
 * pinning one specific chart/legend keeps the spec correct across such
 * refactors — it would take removing EVERY occurrence to make this test
 * miss a real break of the invariant, which is exactly the failure mode
 * this spec exists to catch.
 */

const DEMO_BRANDS = ["GOOG", "AAPL", "MSFT"] as const

const ROUTES: { path: string; heading: string }[] = [
    { path: "/dashboard", heading: "Flow" },
    { path: "/quality", heading: "Quality" },
    { path: "/budget", heading: "Budget & Consumption" },
]

test.describe("@smoke demo mode — zero config", () => {
    for (const { path, heading } of ROUTES) {
        test(`${path} renders deterministic demo data (GOOG/AAPL/MSFT)`, async ({ page }) => {
            await page.goto(path)

            // The h1 is server-rendered: its presence confirms the route
            // resolved to the real page (not an error boundary) before we
            // look for client-rendered chart/legend content below it.
            await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()

            for (const brand of DEMO_BRANDS) {
                await expect(page.getByText(brand).first()).toBeVisible()
            }
        })
    }
})
