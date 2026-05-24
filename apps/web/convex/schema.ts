import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	users: defineTable({
		username: v.string(),
		passwordHash: v.string(),
		createdAt: v.number(),
	}).index("by_username", ["username"]),
	sessions: defineTable({
		token: v.string(),
		userId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_token", ["token"])
		.index("by_user", ["userId"]),
	columns: defineTable({
		title: v.string(),
		order: v.number(),
		createdAt: v.number(),
	}).index("by_order", ["order"]),
	issues: defineTable({
		title: v.string(),
		description: v.string(),
		statusId: v.id("columns"),
		assignee: v.optional(v.string()),
		createdBy: v.id("users"),
		updatedBy: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_status", ["statusId"])
		.index("by_updated", ["updatedAt"]),
	attachments: defineTable({
		issueId: v.id("issues"),
		key: v.string(),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
		url: v.string(),
		createdBy: v.id("users"),
		createdAt: v.number(),
	}).index("by_issue", ["issueId"]),
})
