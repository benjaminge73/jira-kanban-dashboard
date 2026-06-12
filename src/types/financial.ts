export interface BilledDayEntry {
    id: number
    period_type: "week" | "month"
    period_label: string
    brand: string
    billed_days: number
    year: number
    week_number: number | null
    month_number: number
    start_date: string
    end_date: string
}

export interface PlannedRate {
    id: number
    brand: string
    daily_rate: number
    effective_from: string
    effective_to: string | null
}

export interface BudgetChartPoint {
    period: string
    order: number
    period_start?: string
    period_end?: string
    [key: string]: number | string | undefined
}

export interface DateRange {
    from?: string  // yyyy-MM-dd
    to?: string    // yyyy-MM-dd
}
