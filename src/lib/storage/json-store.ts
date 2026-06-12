/**
 * Minimal JSON file store used in live mode for data that does not come from Jira
 * (billed man-days, planned rates, app settings).
 *
 * Files live under DATA_DIR (default: ./data). Writes go through a temp file +
 * rename and are serialized per file, so concurrent server actions within a single
 * process cannot corrupt the store. This is NOT multi-instance safe and does not
 * persist on serverless filesystems (see README limitations).
 */

import { promises as fs } from "fs"
import path from "path"

function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data")
}

function filePath(name: string): string {
  return path.join(dataDir(), name)
}

// Serialize writes per file name
const writeQueues = new Map<string, Promise<void>>()

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath(name), "utf-8")
    return JSON.parse(raw) as T
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback
    throw err
  }
}

export async function writeJsonFile<T>(name: string, data: T): Promise<void> {
  const previous = writeQueues.get(name) ?? Promise.resolve()
  const next = previous
    .catch(() => {}) // a failed previous write must not block the queue
    .then(async () => {
      await fs.mkdir(dataDir(), { recursive: true })
      const target = filePath(name)
      const tmp = `${target}.tmp`
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8")
      await fs.rename(tmp, target)
    })
  writeQueues.set(name, next)
  return next
}
