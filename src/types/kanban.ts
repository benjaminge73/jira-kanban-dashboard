export type KanbanTicket = {
    issue_key: string
    project_key: string
    brand: string // brand identifier (e.g. "GOOG")
    issue_type: string
    summary: string
    status: string
    created_date: string // ISO Date String
    resolution_date: string | null // ISO Date String
    dev_estimation: number // in Story Points
    dev_mandays: number // in Days (Original Estimate / 28800)
    billed_days: number // Extracted from Constants (manually entered)
    priority: string | null // Jira priority (e.g. "High", "Medium", "Low")
}

export type StatusTransition = {
    id: number // numeric identifier (sequential)
    issue_key: string
    from_status: string | null
    to_status: string
    transition_date: string // ISO Date String
    author: string | null
}

export type RejectedTicketDetail = {
    issue_key: string
    summary: string
    status: string // the target status it was pushed back to
    from_status: string // the status it was rejected from
    transition_date: string // date of the rejection transition
}

export type RejectionEvent = {
    status: string // the target status it was pushed back to
    from_status: string // the status it was rejected from
    transition_date: string // date of the rejection transition
    category: "Dev" | "QA" | "Business" // The original phase where it was rejected
}

export type GroupedRejectedTicket = {
    issue_key: string
    summary: string
    current_status: string
    rejections: RejectionEvent[]
}

export type BackflowKPIs = {
    first_time_right_pct: number
    rejections_by_category: {
        Dev: number
        QA: number
        Business: number
    }
    rejections_detail_by_brand: {
        [brand: string]: GroupedRejectedTicket[]
    }
    brands: Record<string, any>
    total_tickets: number
    tickets_with_rejection: number
}
