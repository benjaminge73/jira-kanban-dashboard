// Deterministic pseudo-random number generator (LCG)
// Using a seed ensures the same data is produced every time the app loads.

export class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff
    return (this.seed >>> 0) / 0xffffffff
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** Float in [min, max) */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  /** Pick one element from array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }

  /** Pick n unique elements (without replacement) */
  sample<T>(arr: T[], n: number): T[] {
    const copy = [...arr]
    const result: T[] = []
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = this.int(0, copy.length - 1)
      result.push(copy[idx])
      copy.splice(idx, 1)
    }
    return result
  }
}

/** Add working days (Mon-Fri) to a date */
export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date)
  let remaining = days
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return result
}

/** Format date as YYYY-MM-DD */
export function toISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

/** Parse YYYY-MM-DD to Date (midnight UTC) */
export function fromISO(str: string): Date {
  return new Date(str + "T00:00:00.000Z")
}
