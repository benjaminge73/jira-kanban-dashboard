import { test, expect, type Page } from "@playwright/test"

/**
 * The inverse-of-the-fleet risk: an accidental live-mode toggle putting REAL
 * client data on a PUBLIC, unauthenticated site (this app has no auth at
 * all — see CLAUDE.md, "Ce dépôt ... sans aucune authentification —
 * volontairement"). Live mode is `isLiveMode()` (src/lib/data-source/mode.ts)
 * → `isJiraConfigured()` (src/lib/jira/config.ts): true iff ALL of
 * JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN / JIRA_PROJECT_KEY /
 * JIRA_BRAND_FIELD are set. This spec runs, like the rest of `@smoke`, with
 * NONE of them set — the deployed default — and checks two things that
 * would both be true only if a live toggle slipped through:
 *
 *   1. the UI still identifies itself as demo, not live (mode badges);
 *   2. no real client brand name ever appears in the served HTML.
 *
 * PKP / ATOARM / MTN are the real client brands of this project's sibling
 * internal dashboard (kanban_mAIster_ATI4) — this repo's OWN demo brands
 * are GOOG/AAPL/MSFT (fictional, see demo-zero-config.spec.ts), so a real
 * brand name appearing here would only be explainable by a live Jira
 * connection leaking real project data onto a site anyone can reach with no
 * login. Exact same mechanism and severity as bolossabalos's
 * family-privacy.spec.ts (env var at build time gates what a public
 * deployment is allowed to show) and the same shape of check as
 * kanban_mAIster_ATI4's auth-gate.spec.ts `assertNoLeak` — reused here
 * because there is no auth gate in THIS app to test instead: the leak
 * surface is the live/demo mode switch itself, not a login wall.
 */

const REAL_CLIENT_BRANDS = ["PKP", "ATOARM", "MTN"]
const ROUTES = ["/dashboard", "/quality", "/budget"]

async function assertNoRealBrandLeak(page: Page) {
    const html = await page.content()
    for (const brand of REAL_CLIENT_BRANDS) {
        expect(html, `la page ne doit jamais afficher la marque cliente réelle "${brand}"`).not.toContain(brand)
    }
}

test.describe("@smoke pas de fuite live", () => {
    test("sans JIRA_*, le déploiement s'identifie comme démo, jamais live", async ({ page }) => {
        await page.goto("/dashboard")

        // Deux badges indépendants portent le mode courant (sidebar.tsx) :
        // le sous-titre sous le logo ("Demo Dashboard"/"Live Dashboard",
        // texte en dur) et le badge de pied de nav (traduit,
        // "sidebar.demoMode"/"sidebar.liveMode" → "Demo Mode"/"Live Mode").
        // Les deux doivent dire "demo" — si un seul dérive vers "live" sans
        // JIRA_* configuré, c'est que isJiraConfigured() a été cassé.
        await expect(page.getByText("Demo Dashboard")).toBeVisible()
        await expect(page.getByText("Demo Mode", { exact: true })).toBeVisible()
        await expect(page.getByText("Live Dashboard")).toHaveCount(0)
        await expect(page.getByText("Live Mode", { exact: true })).toHaveCount(0)
    })

    for (const route of ROUTES) {
        test(`${route} ne fuite aucune marque cliente réelle`, async ({ page }) => {
            await page.goto(route)
            await assertNoRealBrandLeak(page)
        })
    }
})
