import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireUser } from "./auth"

const defaultColumns = [
	"Backlog",
	"Ready for development",
	"In progress",
	"Ready for QA",
	"Done",
]

export const seedDefaults = mutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db.query("columns").first()
		if (existing) {
			return
		}

		const now = Date.now()
		for (const [order, title] of defaultColumns.entries()) {
			await ctx.db.insert("columns", { title, order, createdAt: now })
		}
	},
})

export const list = query({
	args: {},
	handler: async (ctx) => {
		const columns = await ctx.db
			.query("columns")
			.withIndex("by_order")
			.collect()
		const issues = await ctx.db
			.query("issues")
			.withIndex("by_updated")
			.order("desc")
			.collect()
		const attachments = await ctx.db.query("attachments").collect()
		const comments = await ctx.db.query("comments").collect()

		return {
			columns,
			issues: issues.map((issue) => ({
				...issue,
				attachments: attachments.filter(
					(attachment) => attachment.issueId === issue._id,
				),
				comments: comments
					.filter((comment) => comment.issueId === issue._id)
					.sort((a, b) => a.createdAt - b.createdAt),
			})),
		}
	},
})

export const createColumn = mutation({
	args: { sessionToken: v.string(), title: v.string() },
	handler: async (ctx, args) => {
		await requireUser(ctx, args.sessionToken)
		const columns = await ctx.db.query("columns").collect()
		return await ctx.db.insert("columns", {
			title: args.title,
			order: columns.length,
			createdAt: Date.now(),
		})
	},
})

export const renameColumn = mutation({
	args: {
		sessionToken: v.string(),
		columnId: v.id("columns"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		await requireUser(ctx, args.sessionToken)
		await ctx.db.patch(args.columnId, { title: args.title })
	},
})

export const create = mutation({
	args: {
		sessionToken: v.string(),
		title: v.string(),
		description: v.string(),
		statusId: v.id("columns"),
		assignee: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx, args.sessionToken)
		const now = Date.now()

		return await ctx.db.insert("issues", {
			title: args.title,
			description: args.description,
			statusId: args.statusId,
			assignee: args.assignee,
			createdBy: userId,
			updatedBy: userId,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const update = mutation({
	args: {
		sessionToken: v.string(),
		issueId: v.id("issues"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		assignee: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx, args.sessionToken)
		await ctx.db.patch(args.issueId, {
			...(args.title !== undefined ? { title: args.title } : {}),
			...(args.description !== undefined
				? { description: args.description }
				: {}),
			...(args.assignee !== undefined ? { assignee: args.assignee } : {}),
			updatedBy: userId,
			updatedAt: Date.now(),
		})
	},
})

export const move = mutation({
	args: {
		sessionToken: v.string(),
		issueId: v.id("issues"),
		statusId: v.id("columns"),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx, args.sessionToken)
		await ctx.db.patch(args.issueId, {
			statusId: args.statusId,
			updatedBy: userId,
			updatedAt: Date.now(),
		})
	},
})

export const addComment = mutation({
	args: {
		sessionToken: v.string(),
		issueId: v.id("issues"),
		body: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx, args.sessionToken)
		const user = await ctx.db.get(userId)
		if (!user) {
			throw new Error("User not found")
		}

		return await ctx.db.insert("comments", {
			issueId: args.issueId,
			body: args.body,
			createdBy: userId,
			authorUsername: user.username,
			createdAt: Date.now(),
		})
	},
})

export const addAttachment = mutation({
	args: {
		sessionToken: v.string(),
		issueId: v.id("issues"),
		key: v.string(),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
		url: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx, args.sessionToken)

		return await ctx.db.insert("attachments", {
			issueId: args.issueId,
			key: args.key,
			fileName: args.fileName,
			contentType: args.contentType,
			size: args.size,
			url: args.url,
			createdBy: userId,
			createdAt: Date.now(),
		})
	},
})
