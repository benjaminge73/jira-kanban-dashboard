// Demo brands used by the mock data generators

export const DEMO_BRANDS = ["GOOG", "AAPL", "MSFT"] as const
export type DemoBrand = (typeof DEMO_BRANDS)[number]

export const BRAND_COLORS: Record<DemoBrand, string> = {
  GOOG: "#4285f4", // Google blue
  AAPL: "#a2aaad", // Apple silver
  MSFT: "#00a4ef", // Microsoft cyan
}

// Distribution weights for ticket generation
export const BRAND_WEIGHTS: Record<DemoBrand, number> = {
  GOOG: 0.40,
  AAPL: 0.35,
  MSFT: 0.25,
}
