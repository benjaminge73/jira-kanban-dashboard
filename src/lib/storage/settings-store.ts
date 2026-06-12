/**
 * Live-mode app settings, persisted in data/settings.json.
 */

import { readJsonFile, writeJsonFile } from "./json-store"

const FILE = "settings.json"

export interface AppSettings {
  showBudgetTab: boolean
}

const DEFAULTS: AppSettings = { showBudgetTab: true }

export async function readSettings(): Promise<AppSettings> {
  const stored = await readJsonFile<Partial<AppSettings>>(FILE, {})
  return { ...DEFAULTS, ...stored }
}

export async function writeSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await readSettings()), ...patch }
  await writeJsonFile(FILE, next)
  return next
}
