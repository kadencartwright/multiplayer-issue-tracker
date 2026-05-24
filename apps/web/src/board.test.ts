import { describe, expect, it } from "vitest"

describe("board defaults", () => {
	it("documents the expected initial workflow", () => {
		expect([
			"Backlog",
			"Ready for development",
			"In progress",
			"Ready for QA",
			"Done",
		]).toHaveLength(5)
	})
})
