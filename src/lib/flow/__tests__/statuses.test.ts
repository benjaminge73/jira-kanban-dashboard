import { describe, expect, it } from "vitest"
import { isDoneStatus, isWipStatus, statusNameForRank, statusRank } from "../statuses"

describe("statusRank", () => {
  it("ranks the canonical pipeline in order", () => {
    expect(statusRank("Backlog")).toBe(0)
    expect(statusRank("In Progress")).toBe(1)
    expect(statusRank("Review")).toBe(2)
    expect(statusRank("IT Testing")).toBe(3)
    expect(statusRank("QA Testing")).toBe(4)
    expect(statusRank("Business Testing")).toBe(5)
    expect(statusRank("Ready for Release")).toBe(6)
    expect(statusRank("Done")).toBe(7)
  })

  it("is case-insensitive and resolves real-world aliases", () => {
    expect(statusRank("TO DO")).toBe(0)
    expect(statusRank("Reopened")).toBe(1)
    expect(statusRank("To Fix")).toBe(1)
    expect(statusRank("Testing Qual-IT")).toBe(3)
    expect(statusRank("Validating on Staging")).toBe(5)
    expect(statusRank("Closed")).toBe(7)
  })

  it("returns -1 for unknown or missing statuses", () => {
    expect(statusRank("Weird Custom Status")).toBe(-1)
    expect(statusRank(null)).toBe(-1)
    expect(statusRank(undefined)).toBe(-1)
  })
})

describe("isDoneStatus", () => {
  it("treats Done and Ready for Release as delivered", () => {
    expect(isDoneStatus("Done")).toBe(true)
    expect(isDoneStatus("ready for release")).toBe(true)
  })

  it("does NOT count canceled/closed as delivered work", () => {
    expect(isDoneStatus("Canceled")).toBe(false)
    expect(isDoneStatus("Closed")).toBe(false)
    expect(isDoneStatus("In Progress")).toBe(false)
  })
})

describe("isWipStatus", () => {
  it("covers In Progress through Business Testing", () => {
    expect(isWipStatus("In Progress")).toBe(true)
    expect(isWipStatus("Review")).toBe(true)
    expect(isWipStatus("Business Testing")).toBe(true)
  })

  it("excludes Backlog, delivered and unknown statuses", () => {
    expect(isWipStatus("Backlog")).toBe(false)
    expect(isWipStatus("Ready for Release")).toBe(false)
    expect(isWipStatus("Done")).toBe(false)
    expect(isWipStatus("Mystery")).toBe(false)
  })
})

describe("statusNameForRank", () => {
  it("maps ranks back to canonical names", () => {
    expect(statusNameForRank(1)).toBe("In Progress")
    expect(statusNameForRank(6)).toBe("Ready for Release")
    expect(statusNameForRank(99)).toBe("Unknown")
  })
})
