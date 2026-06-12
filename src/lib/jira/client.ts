/**
 * Thin Jira Cloud REST v3 client (server-side only).
 *
 * Endpoints used:
 * - POST /rest/api/3/search/jql            — issue search (nextPageToken pagination;
 *   the legacy /rest/api/3/search endpoint was removed by Atlassian in 2025)
 * - POST /rest/api/3/changelog/bulkfetch   — complete status changelogs for up to
 *   1000 issues per call (expand=changelog on search caps at ~40 entries per issue)
 * - GET  /rest/api/3/issue/{key}/changelog — per-issue fallback when bulkfetch
 *   is unavailable on the instance
 * - GET  /rest/api/3/issue/{key}/comment   — comments for rejection details
 */

import { getJiraConfig } from "./config"

export interface JiraIssue {
  id: string
  key: string
  fields: Record<string, unknown>
}

export interface JiraChangelogItem {
  field: string
  fromString: string | null
  toString: string | null
}

export interface JiraChangeHistory {
  created: string
  author?: { displayName?: string }
  items: JiraChangelogItem[]
}

export interface JiraComment {
  author?: { displayName?: string }
  created: string
  body: unknown // Atlassian Document Format
}

const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getJiraConfig()
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64")
  const url = `${cfg.baseUrl}${path}`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      continue
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const error = new Error(`Jira API ${res.status} on ${path}: ${body.slice(0, 500)}`)
      ;(error as Error & { status: number }).status = res.status
      throw error
    }

    return (await res.json()) as T
  }
}

// ─── Issue search ────────────────────────────────────────────────────────────

interface SearchResponse {
  issues: JiraIssue[]
  nextPageToken?: string
}

export async function searchAllIssues(jql: string, fields: string[]): Promise<JiraIssue[]> {
  const cfg = getJiraConfig()
  const issues: JiraIssue[] = []
  let nextPageToken: string | undefined

  do {
    const page = await jiraFetch<SearchResponse>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        fields,
        maxResults: 100,
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
    })
    issues.push(...(page.issues ?? []))
    nextPageToken = page.nextPageToken
  } while (nextPageToken && issues.length < cfg.maxIssues)

  return issues.slice(0, cfg.maxIssues)
}

// ─── Changelogs ──────────────────────────────────────────────────────────────

interface BulkChangelogResponse {
  issueChangeLogs: Array<{
    issueId: string
    changeHistories: JiraChangeHistory[]
  }>
  nextPageToken?: string
}

interface IssueChangelogResponse {
  values: Array<JiraChangeHistory & { items?: JiraChangelogItem[] }>
  startAt: number
  total: number
}

async function fetchIssueChangelog(issueKey: string): Promise<JiraChangeHistory[]> {
  const histories: JiraChangeHistory[] = []
  let startAt = 0
  for (;;) {
    const page = await jiraFetch<IssueChangelogResponse>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog?startAt=${startAt}&maxResults=100`
    )
    histories.push(...(page.values ?? []))
    startAt += page.values?.length ?? 0
    if (!page.values?.length || startAt >= page.total) break
  }
  return histories
}

/**
 * Returns a map issueId/issueKey → status change histories.
 * Tries the bulkfetch endpoint first (1 call per 1000 issues), falls back to
 * per-issue changelog requests if the instance does not support it.
 */
export async function bulkFetchStatusChangelogs(
  issues: Array<{ id: string; key: string }>
): Promise<Map<string, JiraChangeHistory[]>> {
  const result = new Map<string, JiraChangeHistory[]>()
  if (issues.length === 0) return result

  const idToKey = new Map(issues.map((i) => [i.id, i.key]))

  try {
    for (let i = 0; i < issues.length; i += 1000) {
      const chunk = issues.slice(i, i + 1000)
      let nextPageToken: string | undefined
      do {
        const page = await jiraFetch<BulkChangelogResponse>("/rest/api/3/changelog/bulkfetch", {
          method: "POST",
          body: JSON.stringify({
            issueIdsOrKeys: chunk.map((c) => c.key),
            fieldIds: ["status"],
            maxResults: 1000,
            ...(nextPageToken ? { nextPageToken } : {}),
          }),
        })
        for (const entry of page.issueChangeLogs ?? []) {
          const key = idToKey.get(entry.issueId) ?? entry.issueId
          const existing = result.get(key) ?? []
          result.set(key, existing.concat(entry.changeHistories ?? []))
        }
        nextPageToken = page.nextPageToken
      } while (nextPageToken)
    }
    return result
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err
    // Instance without bulkfetch — fall back to per-issue changelog calls
    result.clear()
  }

  for (const issue of issues) {
    result.set(issue.key, await fetchIssueChangelog(issue.key))
  }
  return result
}

// ─── Comments ────────────────────────────────────────────────────────────────

interface CommentsResponse {
  comments: JiraComment[]
}

export async function fetchIssueComments(issueKey: string): Promise<JiraComment[]> {
  const res = await jiraFetch<CommentsResponse>(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?orderBy=created&maxResults=100`
  )
  return res.comments ?? []
}
