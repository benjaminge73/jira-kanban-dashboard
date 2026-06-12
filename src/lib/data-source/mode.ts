/**
 * Server-side mode detection. Never import from client components:
 * the mode must reach the browser only through props.
 */

import { isJiraConfigured } from "../jira/config"
import type { AppMode } from "./types"

export function isLiveMode(): boolean {
  return isJiraConfigured()
}

export function getMode(): AppMode {
  return isLiveMode() ? "live" : "demo"
}
