"use server"

// Billed man-days administration.
// Demo mode: read-only — all writes return an error message.
// Live mode: reads/writes go to the local JSON store (data/financial.json).

import { revalidatePath } from "next/cache"
import { getDataSource, isLiveMode } from "../data-source"
import {
  deleteStoredBilledDay,
  deleteStoredBilledPeriod,
  deleteStoredPlannedRate,
  upsertStoredBilledDay,
  upsertStoredPlannedRate,
} from "../storage/financial-store"
import type { BilledDayEntry, PlannedRate } from "../../types/financial"

export type BilledDayInput = Omit<BilledDayEntry, "id">
export type PlannedRateInput = Omit<PlannedRate, "id">

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getBilledDaysForAdmin(): Promise<BilledDayEntry[]> {
  return getDataSource().getBilledDays("month")
}

export async function getWeeklyBilledDaysForAdmin(): Promise<BilledDayEntry[]> {
  return getDataSource().getBilledDays("week")
}

export async function getPlannedRatesForAdmin(): Promise<PlannedRate[]> {
  return getDataSource().getPlannedRates()
}

// ── Write (real in live mode, no-op in demo mode) ─────────────────────────────

const DEMO_MESSAGE = "Demo mode — data is read-only."

async function guardedWrite(write: () => Promise<void>): Promise<{ error?: string }> {
  if (!isLiveMode()) return { error: DEMO_MESSAGE }
  try {
    await write()
    revalidatePath("/", "layout")
    return {}
  } catch (err) {
    console.error("[jh] write failed:", err)
    return { error: "Failed to save — check server logs." }
  }
}

export async function upsertBilledDay(entry: BilledDayInput): Promise<{ error?: string }> {
  return guardedWrite(() => upsertStoredBilledDay(entry))
}

export async function deleteBilledDay(id: number): Promise<{ error?: string }> {
  return guardedWrite(() => deleteStoredBilledDay(id))
}

export async function upsertPlannedRate(entry: PlannedRateInput): Promise<{ error?: string }> {
  return guardedWrite(() => upsertStoredPlannedRate(entry))
}

export async function deletePlannedRate(id: number): Promise<{ error?: string }> {
  return guardedWrite(() => deleteStoredPlannedRate(id))
}

export async function deleteBilledPeriod(
  periodLabel: string,
  periodType: "week" | "month"
): Promise<{ error?: string }> {
  return guardedWrite(() => deleteStoredBilledPeriod(periodLabel, periodType))
}
