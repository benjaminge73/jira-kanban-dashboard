/**
 * Canonical Kanban pipeline, shared by every KPI computation.
 * In live mode real Jira statuses are first renamed via JIRA_STATUS_MAPPING;
 * the alias lists below absorb common variants that were left unmapped.
 *
 * Pure module — safe to import from server and client code, and from tests.
 */

export const CANONICAL_PIPELINE = [
  "Backlog",
  "In Progress",
  "Review",
  "IT Testing",
  "QA Testing",
  "Business Testing",
  "Ready for Release",
  "Done",
] as const

const RANK_ALIASES: Record<number, string[]> = {
  0: ["backlog", "to do", "open"],
  1: ["in progress", "to fix", "reopened", "refinement"],
  2: ["review"],
  3: ["it testing", "testing qual-it", "testing qual it"],
  4: ["qa testing", "testing qual-bu", "testing qual bu"],
  5: ["business testing", "validating on staging"],
  6: ["ready for release"],
  7: ["done", "canceled", "closed"],
}

const rankByStatus = new Map<string, number>()
for (const [rank, aliases] of Object.entries(RANK_ALIASES)) {
  for (const alias of aliases) rankByStatus.set(alias, Number(rank))
}

/** Pipeline position of a status (0 = Backlog … 7 = Done), or -1 if unknown. */
export function statusRank(status: string | null | undefined): number {
  if (!status) return -1
  return rankByStatus.get(status.toLowerCase()) ?? -1
}

// "Completed" means delivered (Done / Ready for Release) — NOT canceled/closed,
// which share rank 7 for backflow ordering but must not count as delivered work.
const DONE_SET = new Set(["done", "ready for release"])

export function isDoneStatus(status: string): boolean {
  return DONE_SET.has(status.toLowerCase())
}

/** Work in progress: between In Progress and Business Testing inclusive. */
export function isWipStatus(status: string): boolean {
  const rank = statusRank(status)
  return rank >= 1 && rank <= 5
}

/** Canonical display name for a pipeline rank. */
export function statusNameForRank(rank: number): string {
  return CANONICAL_PIPELINE[rank] ?? "Unknown"
}
