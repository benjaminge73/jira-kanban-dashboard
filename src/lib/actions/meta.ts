"use server"

import { getDataSource } from "../data-source"
import type { AppMode } from "../data-source"

export interface UiMeta {
  mode: AppMode
  brands: string[]
  brandColors: Record<string, string>
}

/** Single call for pages to retrieve mode + brand metadata to pass to client components. */
export async function getUiMeta(): Promise<UiMeta> {
  const source = getDataSource()
  const [brands, brandColors] = await Promise.all([
    source.getBrands(),
    source.getBrandColors(),
  ])
  return { mode: source.mode, brands, brandColors }
}
