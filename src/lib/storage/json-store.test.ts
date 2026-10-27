import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readJsonFile, writeJsonFile } from "./json-store"

describe("json-store", () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "json-store-"))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  it("writes and reads back under DATA_DIR", async () => {
    vi.stubEnv("DATA_DIR", dir)
    await writeJsonFile("settings.json", { showBudgetTab: true })
    expect(JSON.parse(await readFile(path.join(dir, "settings.json"), "utf-8"))).toEqual({ showBudgetTab: true })
    expect(await readJsonFile("settings.json", null)).toEqual({ showBudgetTab: true })
  })

  it("defaults to ./data under the working directory", async () => {
    vi.stubEnv("DATA_DIR", "")
    vi.spyOn(process, "cwd").mockReturnValue(dir)
    await writeJsonFile("financial.json", { billedDays: [] })
    expect(JSON.parse(await readFile(path.join(dir, "data", "financial.json"), "utf-8"))).toEqual({ billedDays: [] })
  })

  it("returns the fallback when the file does not exist", async () => {
    vi.stubEnv("DATA_DIR", dir)
    expect(await readJsonFile("missing.json", { empty: true })).toEqual({ empty: true })
  })
})
