import { liveDataSource } from "./live"
import { mockDataSource } from "./mock"
import { isLiveMode } from "./mode"
import type { DataSource } from "./types"

export type { AppMode, CalendarBounds, DataSource, RejectionComment } from "./types"
export { getMode, isLiveMode } from "./mode"

export function getDataSource(): DataSource {
  return isLiveMode() ? liveDataSource : mockDataSource
}
