/**
 * Live-mode persistence for financial data (billed man-days + planned rates).
 * Backed by data/financial.json — created on first write, starts empty.
 */

import type { BilledDayEntry, PlannedRate } from "../../types/financial"
import { readJsonFile, writeJsonFile } from "./json-store"

const FILE = "financial.json"

interface FinancialFile {
  billedDays: BilledDayEntry[]
  plannedRates: PlannedRate[]
  nextId: number
}

const EMPTY: FinancialFile = { billedDays: [], plannedRates: [], nextId: 1 }

async function load(): Promise<FinancialFile> {
  return readJsonFile<FinancialFile>(FILE, EMPTY)
}

export async function getStoredBilledDays(): Promise<BilledDayEntry[]> {
  return (await load()).billedDays
}

export async function getStoredPlannedRates(): Promise<PlannedRate[]> {
  return (await load()).plannedRates
}

export async function upsertStoredBilledDay(input: Omit<BilledDayEntry, "id">): Promise<void> {
  const file = await load()
  const existing = file.billedDays.find(
    (e) =>
      e.period_type === input.period_type &&
      e.period_label === input.period_label &&
      e.brand === input.brand &&
      e.year === input.year
  )
  if (existing) {
    Object.assign(existing, input)
  } else {
    file.billedDays.push({ id: file.nextId++, ...input })
  }
  await writeJsonFile(FILE, file)
}

export async function deleteStoredBilledDay(id: number): Promise<void> {
  const file = await load()
  file.billedDays = file.billedDays.filter((e) => e.id !== id)
  await writeJsonFile(FILE, file)
}

export async function deleteStoredBilledPeriod(
  periodLabel: string,
  periodType: "week" | "month"
): Promise<void> {
  const file = await load()
  file.billedDays = file.billedDays.filter(
    (e) => !(e.period_label === periodLabel && e.period_type === periodType)
  )
  await writeJsonFile(FILE, file)
}

export async function upsertStoredPlannedRate(input: Omit<PlannedRate, "id">): Promise<void> {
  const file = await load()
  const existing = file.plannedRates.find(
    (r) => r.brand === input.brand && r.effective_from === input.effective_from
  )
  if (existing) {
    Object.assign(existing, input)
  } else {
    file.plannedRates.push({ id: file.nextId++, ...input })
  }
  await writeJsonFile(FILE, file)
}

export async function deleteStoredPlannedRate(id: number): Promise<void> {
  const file = await load()
  file.plannedRates = file.plannedRates.filter((r) => r.id !== id)
  await writeJsonFile(FILE, file)
}
