import type { StatusTransition } from "../../types/kanban"
import { SeededRandom, toISO, addWorkingDays } from "./generator"
import { generateTickets } from "./tickets"

// ─── Full Kanban pipeline ─────────────────────────────────────────────────────

const PIPELINE = [
  "Backlog",
  "In Progress",
  "Review",
  "IT Testing",
  "QA Testing",
  "Business Testing",
  "Ready for Release",
  "Done",
]

// Statuses that can be a rejection target
const REJECTION_TARGETS: Record<number, number[]> = {
  2: [1],       // Review → In Progress
  3: [1, 2],    // IT Testing → In Progress / Review
  4: [1, 2, 3], // QA Testing → In Progress / Review / IT Testing
  5: [2, 3],    // Business Testing → Review / IT Testing
  6: [3, 4],    // Ready for Release → IT Testing / QA Testing
}

// Rejection probability at each stage (index in pipeline)
const REJECTION_PROB: Record<number, number> = {
  2: 0.18, // 18% chance of rejection at Review
  3: 0.14, // 14% at Testing Qual-IT
  4: 0.10, // 10% at Testing Qual-BU
  5: 0.06, // 6% at Validating on Staging
  6: 0.04, // 4% at Ready for Release
}

// ─── Transition generator ─────────────────────────────────────────────────────

let cachedTransitions: StatusTransition[] | null = null

export function generateTransitions(): StatusTransition[] {
  if (cachedTransitions) return cachedTransitions

  const rng = new SeededRandom(99_2026)
  const tickets = generateTickets()
  const transitions: StatusTransition[] = []
  let idCounter = 1

  for (const ticket of tickets) {
    const createdDate = new Date(ticket.created_date + "T00:00:00.000Z")
    const resolutionDate = ticket.resolution_date
      ? new Date(ticket.resolution_date + "T00:00:00.000Z")
      : null

    // Start: Backlog entry (creation)
    let currentDate = new Date(createdDate)
    let prevStatus: string | null = null

    // Determine final pipeline target index
    const finalIdx = resolutionDate
      ? ticket.status.toLowerCase() === "ready for release" ? 6 : 7
      : PIPELINE.indexOf(ticket.status) !== -1 ? PIPELINE.indexOf(ticket.status) : 5

    // Walk through pipeline stages 0 → finalIdx
    let i = 0

    while (i <= finalIdx) {
      const toStatus = PIPELINE[i]

      // Advance date by 1-3 working days per step (compressed to fit in resolution window)
      const totalSteps = finalIdx + 1
      const totalWorkingDays = resolutionDate
        ? Math.max(1, Math.floor((resolutionDate.getTime() - createdDate.getTime()) / (24 * 3600 * 1000) * 5 / 7))
        : rng.int(5, 20)
      const daysPerStep = Math.max(1, Math.floor(totalWorkingDays / totalSteps))
      currentDate = addWorkingDays(currentDate, rng.int(Math.max(1, daysPerStep - 1), daysPerStep + 1))

      // Clamp to resolution date
      if (resolutionDate && currentDate > resolutionDate) {
        currentDate = new Date(resolutionDate)
      }

      transitions.push({
        id: idCounter++,
        issue_key: ticket.issue_key,
        from_status: prevStatus,
        to_status: toStatus,
        transition_date: currentDate.toISOString(),
        author: null,
      })

      prevStatus = toStatus

      // Should we inject a rejection at this stage?
      const rejProb = REJECTION_PROB[i]
      if (rejProb && rng.next() < rejProb && i > 1 && resolutionDate) {
        // Pick a target status to reject to
        const targets = REJECTION_TARGETS[i]
        const targetIdx = targets ? rng.pick(targets) : i - 1
        const rejectionTarget = PIPELINE[targetIdx]

        // Rejection transition
        currentDate = addWorkingDays(currentDate, rng.int(0, 1))
        if (currentDate > resolutionDate) currentDate = new Date(resolutionDate)

        transitions.push({
          id: idCounter++,
          issue_key: ticket.issue_key,
          from_status: toStatus,
          to_status: rejectionTarget,
          transition_date: currentDate.toISOString(),
          author: null,
        })

        prevStatus = rejectionTarget

        // Go back up from the rejection target to resume pipeline
        // Re-enter from targetIdx → i
        for (let j = targetIdx; j < i; j++) {
          currentDate = addWorkingDays(currentDate, rng.int(1, 3))
          if (currentDate > resolutionDate) currentDate = new Date(resolutionDate)

          transitions.push({
            id: idCounter++,
            issue_key: ticket.issue_key,
            from_status: PIPELINE[j],
            to_status: PIPELINE[j + 1],
            transition_date: currentDate.toISOString(),
            author: null,
          })
          prevStatus = PIPELINE[j + 1]
        }
      }

      i++
    }
  }

  cachedTransitions = transitions
  return transitions
}
