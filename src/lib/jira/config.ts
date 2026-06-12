/**
 * Jira Cloud configuration, read from environment variables (server-side only).
 * Live mode is enabled when all required variables are present.
 */

import { z } from "zod"

const requiredVars = [
  "JIRA_BASE_URL",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "JIRA_PROJECT_KEY",
  "JIRA_BRAND_FIELD",
] as const

const configSchema = z.object({
  baseUrl: z.string().url().transform((u) => u.replace(/\/+$/, "")),
  email: z.string().min(1),
  apiToken: z.string().min(1),
  projectKey: z.string().min(1),
  brandField: z.string().min(1),
  storyPointsField: z.string().min(1).default("customfield_10016"),
  // Which Jira time field feeds dev_mandays (seconds, converted to 8h days)
  mandaysSource: z.enum(["timespent", "timeoriginalestimate"]).default("timespent"),
  extraJql: z.string().optional(),
  // Maps real Jira status names (lowercase) → canonical pipeline names
  statusMapping: z.record(z.string(), z.string()).default({}),
  cacheTtlSeconds: z.coerce.number().int().positive().default(300),
  maxIssues: z.coerce.number().int().positive().default(2000),
})

export type JiraConfig = z.infer<typeof configSchema>

export function isJiraConfigured(): boolean {
  return requiredVars.every((v) => !!process.env[v])
}

/**
 * True when JIRA_MANDAYS_SOURCE is explicitly set. Without a deliberate choice
 * of time field, actual man-days are unreliable (e.g. nobody logs work), so the
 * planned-vs-actual UI is hidden in live mode unless this returns true.
 */
export function isMandaysSourceConfigured(): boolean {
  return !!process.env.JIRA_MANDAYS_SOURCE
}

let cachedConfig: JiraConfig | null = null

export function getJiraConfig(): JiraConfig {
  if (cachedConfig) return cachedConfig

  let statusMapping: Record<string, string> = {}
  if (process.env.JIRA_STATUS_MAPPING) {
    try {
      const parsed = JSON.parse(process.env.JIRA_STATUS_MAPPING)
      statusMapping = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k.toLowerCase(), String(v)])
      )
    } catch {
      throw new Error("JIRA_STATUS_MAPPING is not valid JSON")
    }
  }

  cachedConfig = configSchema.parse({
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
    projectKey: process.env.JIRA_PROJECT_KEY,
    brandField: process.env.JIRA_BRAND_FIELD,
    storyPointsField: process.env.JIRA_STORY_POINTS_FIELD || undefined,
    mandaysSource: process.env.JIRA_MANDAYS_SOURCE || undefined,
    extraJql: process.env.JIRA_JQL || undefined,
    statusMapping,
    cacheTtlSeconds: process.env.JIRA_CACHE_TTL || undefined,
    maxIssues: process.env.JIRA_MAX_ISSUES || undefined,
  })
  return cachedConfig
}
