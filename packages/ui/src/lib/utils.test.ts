import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
	it("merges tailwind class conflicts", () => {
		expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4")
	})
})
