/**
 * Maps Jira Cloud API payloads to the app's internal data model.
 */

import type { KanbanTicket, StatusTransition } from "../../types/kanban"
import type { JiraChangeHistory, JiraIssue } from "./client"
import type { JiraConfig } from "./config"

const SECONDS_PER_MANDAY = 28_800 // 8h working day

/** Applies the optional JIRA_STATUS_MAPPING (case-insensitive on input). */
export function mapStatus(name: string | null | undefined, cfg: JiraConfig): string {
  if (!name) return ""
  return cfg.statusMapping[name.toLowerCase()] ?? name
}

/**
 * Extracts a brand label from a custom field value. Handles plain strings,
 * select-field option objects ({ value } / { name }) and multi-selects (first option).
 */
export function extractBrand(fieldValue: unknown): string {
  const first = Array.isArray(fieldValue) ? fieldValue[0] : fieldValue
  if (typeof first === "string" && first.trim()) return first.trim()
  if (first && typeof first === "object") {
    const obj = first as { value?: unknown; name?: unknown }
    if (typeof obj.value === "string" && obj.value.trim()) return obj.value.trim()
    if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim()
  }
  return "Other"
}

/** Flattens an Atlassian Document Format node tree to plain text. */
export function adfToPlainText(adf: unknown): string {
  if (typeof adf === "string") return adf
  if (!adf || typeof adf !== "object") return ""
  const node = adf as { type?: string; text?: string; content?: unknown[] }
  if (node.type === "text" && typeof node.text === "string") return node.text
  if (!Array.isArray(node.content)) return ""
  const parts = node.content.map(adfToPlainText).filter(Boolean)
  const isBlock = node.type === "paragraph" || node.type === "heading"
  return parts.join(isBlock ? " " : "\n").trim()
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function mapIssueToTicket(issue: JiraIssue, cfg: JiraConfig): KanbanTicket {
  const f = issue.fields
  const status = (f.status as { name?: string } | undefined)?.name ?? "Unknown"
  const timeSeconds = Number(f[cfg.mandaysSource]) || 0
  return {
    issue_key: issue.key,
    project_key: (f.project as { key?: string } | undefined)?.key ?? cfg.projectKey,
    brand: extractBrand(f[cfg.brandField]),
    issue_type: (f.issuetype as { name?: string } | undefined)?.name ?? "Task",
    summary: typeof f.summary === "string" ? f.summary : "",
    status: mapStatus(status, cfg),
    created_date: toIsoDate(f.created) ?? new Date().toISOString(),
    resolution_date: toIsoDate(f.resolutiondate),
    dev_estimation: Number(f[cfg.storyPointsField]) || 0,
    dev_mandays: timeSeconds / SECONDS_PER_MANDAY,
    billed_days: 0,
    priority: (f.priority as { name?: string } | undefined)?.name ?? null,
  }
}

export function mapChangelogToTransitions(
  issueKey: string,
  histories: JiraChangeHistory[],
  cfg: JiraConfig,
  startId: number
): StatusTransition[] {
  const transitions: StatusTransition[] = []
  let id = startId

  const sorted = [...histories].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
  )

  for (const history of sorted) {
    for (const item of history.items ?? []) {
      if (item.field !== "status") continue
      transitions.push({
        id: id++,
        issue_key: issueKey,
        from_status: item.fromString ? mapStatus(item.fromString, cfg) : null,
        to_status: mapStatus(item.toString, cfg),
        transition_date: new Date(history.created).toISOString(),
        author: history.author?.displayName ?? null,
      })
    }
  }

  return transitions
}
