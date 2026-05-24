import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
	action,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server"

type AuthSession = {
	token: string
	user: {
		_id: Id<"users">
		username: string
	}
}

export const viewer = query({
	args: { sessionToken: v.optional(v.string()) },
	handler: async (ctx, args) => {
		if (!args.sessionToken) {
			return null
		}

		const session = await ctx.db
			.query("sessions")
			.withIndex("by_token", (q) => q.eq("token", args.sessionToken ?? ""))
			.unique()

		if (!session) {
			return null
		}

		const user = await ctx.db.get(session.userId)
		return user ? { _id: user._id, username: user.username } : null
	},
})

export const logout = mutation({
	args: { sessionToken: v.string() },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("sessions")
			.withIndex("by_token", (q) => q.eq("token", args.sessionToken))
			.unique()

		if (session) {
			await ctx.db.delete(session._id)
		}
	},
})

export const listUsers = query({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query("users").collect()
		return users.map((user) => ({
			_id: user._id,
			username: user.username,
		}))
	},
})

export const getUserByUsername = internalQuery({
	args: { username: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", args.username))
			.unique()
	},
})

export const createUserSession = internalMutation({
	args: { username: v.string(), passwordHash: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", args.username))
			.unique()

		if (existing) {
			throw new Error("Username is already taken")
		}

		const now = Date.now()
		const userId = await ctx.db.insert("users", {
			username: args.username,
			passwordHash: args.passwordHash,
			createdAt: now,
		})
		const token = crypto.randomUUID()

		await ctx.db.insert("sessions", {
			token,
			userId,
			createdAt: now,
		})

		return { token, user: { _id: userId, username: args.username } }
	},
})

export const createSession = internalMutation({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId)
		if (!user) {
			throw new Error("User not found")
		}

		const token = crypto.randomUUID()
		await ctx.db.insert("sessions", {
			token,
			userId: args.userId,
			createdAt: Date.now(),
		})

		return { token, user: { _id: user._id, username: user.username } }
	},
})

export async function requireUser(
	ctx: QueryCtx | MutationCtx,
	sessionToken: string,
) {
	const session = await ctx.db
		.query("sessions")
		.withIndex("by_token", (q) => q.eq("token", sessionToken))
		.unique()

	if (!session) {
		throw new Error("Authentication required")
	}

	return session.userId as Id<"users">
}

export const register = action({
	args: { username: v.string(), password: v.string() },
	handler: async (ctx, args): Promise<AuthSession> => {
		const bcrypt = await import("bcryptjs")
		const passwordHash = await bcrypt.hash(args.password, 12)

		return await ctx.runMutation(internal.auth.createUserSession, {
			username: args.username.trim().toLowerCase(),
			passwordHash,
		})
	},
})

export const login = action({
	args: { username: v.string(), password: v.string() },
	handler: async (ctx, args): Promise<AuthSession> => {
		const user: Doc<"users"> | null = await ctx.runQuery(
			internal.auth.getUserByUsername,
			{
				username: args.username.trim().toLowerCase(),
			},
		)

		if (!user) {
			throw new Error("Invalid username or password")
		}

		const bcrypt = await import("bcryptjs")
		const valid = await bcrypt.compare(args.password, user.passwordHash)
		if (!valid) {
			throw new Error("Invalid username or password")
		}

		return await ctx.runMutation(internal.auth.createSession, {
			userId: user._id,
		})
	},
})
