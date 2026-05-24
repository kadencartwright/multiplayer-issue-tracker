#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"

const convexUrl = process.env.CONVEX_URL ?? "http://127.0.0.1:3210"
const sessionToken = process.env.MIT_SESSION_TOKEN

const convex = new ConvexHttpClient(convexUrl)

function requireSession() {
	if (!sessionToken) {
		throw new Error(
			"Set MIT_SESSION_TOKEN to an authenticated local session token",
		)
	}

	return sessionToken
}

const server = new McpServer({
	name: "multiplayer-issue-tracker",
	version: "0.0.0",
})

server.tool(
	"list_issues",
	"List columns and issues from the shared board",
	{},
	async () => {
		const board = await convex.query("issues:list" as never, {} as never)
		return {
			content: [{ type: "text", text: JSON.stringify(board, null, 2) }],
		}
	},
)

server.tool(
	"create_issue",
	"Create an issue in a specific status column",
	{
		title: z.string(),
		description: z.string().default(""),
		statusId: z.string(),
		assignee: z.string().optional(),
	},
	async (input) => {
		const issueId = await convex.mutation(
			"issues:create" as never,
			{
				sessionToken: requireSession(),
				...input,
			} as never,
		)

		return {
			content: [{ type: "text", text: `Created issue ${issueId}` }],
		}
	},
)

server.tool(
	"update_issue",
	"Update an issue title, description, or assignee",
	{
		issueId: z.string(),
		title: z.string().optional(),
		description: z.string().optional(),
		assignee: z.string().optional(),
	},
	async (input) => {
		await convex.mutation(
			"issues:update" as never,
			{
				sessionToken: requireSession(),
				...input,
			} as never,
		)

		return {
			content: [{ type: "text", text: `Updated issue ${input.issueId}` }],
		}
	},
)

server.tool(
	"move_issue",
	"Move an issue to another status column",
	{
		issueId: z.string(),
		statusId: z.string(),
	},
	async (input) => {
		await convex.mutation(
			"issues:move" as never,
			{
				sessionToken: requireSession(),
				...input,
			} as never,
		)

		return {
			content: [{ type: "text", text: `Moved issue ${input.issueId}` }],
		}
	},
)

const transport = new StdioServerTransport()
await server.connect(transport)
