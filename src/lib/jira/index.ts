/**
 * Jira data orchestration: search issues, fetch complete status changelogs,
 * map everything to the internal model, and cache the snapshot in memory.
 *
 * Pages render with revalidate=0, so this module-level TTL cache (stored on
 * globalThis to survive dev HMR) is what protects the Jira instance from
 * being hit on every request.
 */

import type { KanbanTicket, StatusTransition } from "../../types/kanban"
import { bulkFetchStatusChangelogs, fetchIssueComments, searchAllIssues } from "./client"
import { getJiraConfig } from "./config"
import { adfToPlainText, mapChangelogToTransitions, mapIssueToTicket } from "./mapping"

export interface JiraSnapshot {
  tickets: KanbanTicket[]
  transitions: StatusTransition[]
  fetchedAt: number
}

interface JiraCache {
  snapshot: JiraSnapshot | null
  inflight: Promise<JiraSnapshot> | null
  comments: Map<string, { fetchedAt: number; comments: { author: string; created: string; body: string }[] }>
}

const globalCache = globalThis as typeof globalThis & { __jiraCache?: JiraCache }

function cache(): JiraCache {
  if (!globalCache.__jiraCache) {
    globalCache.__jiraCache = { snapshot: null, inflight: null, comments: new Map() }
  }
  return globalCache.__jiraCache
}

function buildJql(): string {
  const cfg = getJiraConfig()
  let jql = `project = "${cfg.projectKey}"`
  if (cfg.extraJql) jql += ` AND (${cfg.extraJql})`
  return `${jql} ORDER BY created ASC`
}

async function fetchSnapshot(): Promise<JiraSnapshot> {
  const cfg = getJiraConfig()
  const fields = [
    "summary",
    "status",
    "issuetype",
    "project",
    "created",
    "resolutiondate",
    "priority",
    cfg.brandField,
    cfg.storyPointsField,
    cfg.mandaysSource,
  ]

  const issues = await searchAllIssues(buildJql(), fields)
  const changelogs = await bulkFetchStatusChangelogs(
    issues.map((i) => ({ id: i.id, key: i.key }))
  )

  const tickets = issues.map((issue) => mapIssueToTicket(issue, cfg))
  const transitions: StatusTransition[] = []
  for (const issue of issues) {
    const histories = changelogs.get(issue.key) ?? []
    transitions.push(
      ...mapChangelogToTransitions(issue.key, histories, cfg, transitions.length + 1)
    )
  }

  return { tickets, transitions, fetchedAt: Date.now() }
}

export async function getJiraData(): Promise<JiraSnapshot> {
  const cfg = getJiraConfig()
  const c = cache()
  const ttlMs = cfg.cacheTtlSeconds * 1000

  if (c.snapshot && Date.now() - c.snapshot.fetchedAt < ttlMs) {
    return c.snapshot
  }
  if (c.inflight) return c.inflight

  c.inflight = fetchSnapshot()
    .then((snapshot) => {
      c.snapshot = snapshot
      return snapshot
    })
    .catch((err) => {
      console.error("[jira] failed to fetch data:", err)
      // Generic message: Next.js shows it via the error boundary; details stay in server logs
      throw new Error(
        "Could not load data from Jira. Check the JIRA_* environment variables and server logs."
      )
    })
    .finally(() => {
      c.inflight = null
    })

  return c.inflight
}

const COMMENTS_TTL_MS = 60_000

export async function getJiraRejectionComments(
  issueKey: string,
  transitionDate: string
): Promise<{ author: string; created: string; body: string }[]> {
  const c = cache()
  const cached = c.comments.get(issueKey)

  let all: { author: string; created: string; body: string }[]
  if (cached && Date.now() - cached.fetchedAt < COMMENTS_TTL_MS) {
    all = cached.comments
  } else {
    try {
      const raw = await fetchIssueComments(issueKey)
      all = raw.map((comment) => ({
        author: comment.author?.displayName ?? "Unknown",
        created: comment.created,
        body: adfToPlainText(comment.body),
      }))
    } catch (err) {
      console.error(`[jira] failed to fetch comments for ${issueKey}:`, err)
      return []
    }
    c.comments.set(issueKey, { fetchedAt: Date.now(), comments: all })
  }

  // Keep comments within ±24h of the rejection transition (matches the UI copy)
  const pivot = new Date(transitionDate).getTime()
  const dayMs = 86_400_000
  return all.filter((comment) => {
    const t = new Date(comment.created).getTime()
    return !isNaN(t) && Math.abs(t - pivot) <= dayMs
  })
}
