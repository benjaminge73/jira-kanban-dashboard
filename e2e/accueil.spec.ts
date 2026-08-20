import { test, expect } from "@playwright/test"

/**
 * The home page (/dashboard, the "Flow" tab) renders and shows its real
 * content — navigation, tabs, first demo data — with no authentication,
 * because this app HAS none (deliberately: see CLAUDE.md, "Purpose").
 *
 * Unlike the sibling repos whose home spec can only check *structure*
 * (their data comes from a live Jira sync that shifts day to day — see
 * kanban_mAIster_ATI4's e2e/accueil.spec.ts), this repo's home page is the
 * most reliable one in the fleet, and the spec below leans into that: demo
 * mode is a `SeededRandom(42_2026)` generator (src/lib/mock-data/tickets.ts)
 * — same seed, same output, every run, every environment, forever. The
 * "Completed Tickets" KPI in particular is not just stable but *exactly*
 * computable ahead of time: it's `totalTickets.toString()` where
 * `totalTickets` counts every generated ticket whose status is Done/Ready
 * for Release (src/app/dashboard/page.tsx) — and the generator always
 * produces exactly 420 such tickets (300 Done + 120 Ready for Release,
 * verified by literally running `generateTickets()`) plus exactly 20
 * separate "in flight" tickets that never carry those statuses. This is a
 * fixed function of the fixed seed — not a "which day is it" computation.
 *
 * ⚠️ We navigate explicitly to /dashboard?all=true: without it,
 * DateRangeSidebar's mount effect (src/components/layout/date-range-sidebar.tsx)
 * redirects to a `from`/`to` pair spanning the CURRENT calendar month before
 * the KPIs render, which would make "Completed Tickets" a function of
 * today's date instead of the fixed 420 — the exact instability this test
 * exists to avoid. (Confirmed empirically: without `all=true` the card read
 * "36", the August-2026-only count, not 420.) Same pitfall, same fix, as
 * kanban_mAIster_ATI4's e2e/accueil.spec.ts.
 */

test.describe("@smoke accueil", () => {
    test("la page Flow (accueil) rend son contenu réel sans authentification", async ({ page }) => {
        await page.goto("/dashboard?all=true")

        // Navigation principale (Sidebar) — accessible sans aucun cookie/login.
        await expect(page.getByRole("link", { name: "Flow" })).toBeVisible()
        await expect(page.getByRole("link", { name: "Quality" })).toBeVisible()
        await expect(page.getByRole("link", { name: "Budget" })).toBeVisible()

        // En-tête de l'onglet
        await expect(page.getByRole("heading", { name: "Flow", level: 1 })).toBeVisible()

        // Les cinq cartes KPI sont présentes — ciblées par leur h3 exact.
        for (const title of ["Completed Tickets", "Median Cycle Time", "Work In Progress", "Story Points", "Actual / Planned"]) {
            await expect(page.getByRole("heading", { name: title, level: 3, exact: true })).toBeVisible()
        }

        // Premières données de démo : la carte "Completed Tickets" affiche la
        // valeur EXACTE et déterministe "420" (voir commentaire d'en-tête).
        const completedTicketsCard = page.locator(".rounded-xl", {
            has: page.getByRole("heading", { name: "Completed Tickets", level: 3, exact: true }),
        })
        await expect(completedTicketsCard.getByText("420", { exact: true })).toBeVisible()
    })
})
