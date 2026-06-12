"use server"

import { revalidatePath } from "next/cache"
import { isLiveMode } from "../data-source"
import { isAdminAuthenticated } from "../auth/admin"
import { readSettings, writeSettings, type AppSettings } from "../storage/settings-store"

export async function getAppSettings(): Promise<AppSettings> {
  // Demo mode always shows every tab; settings only apply in live mode
  if (!isLiveMode()) return { showBudgetTab: true }
  return readSettings()
}

export async function setShowBudgetTab(visible: boolean): Promise<{ error?: string }> {
  if (!isLiveMode()) return { error: "Demo mode — data is read-only." }
  if (!(await isAdminAuthenticated())) return { error: "Unauthorized — please log in." }
  try {
    await writeSettings({ showBudgetTab: visible })
    revalidatePath("/", "layout")
    return {}
  } catch (err) {
    console.error("[settings] write failed:", err)
    return { error: "Failed to save — check server logs." }
  }
}
