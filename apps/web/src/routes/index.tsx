import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Input,
	Label,
	Textarea,
} from "@mit/ui"
import { createFileRoute } from "@tanstack/react-router"
import { useAction, useMutation, useQuery } from "convex/react"
import { ImageIcon, LogOut, Plus, Upload } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"

export const Route = createFileRoute("/")({ component: Home })

type Session = {
	token: string
	user: {
		username: string
	}
}

type BoardData = {
	columns: Array<Doc<"columns">>
	issues: Array<Doc<"issues"> & { attachments: Array<Doc<"attachments">> }>
}

function Home() {
	const [session, setSession] = useState<Session | null>(() => {
		if (typeof window === "undefined") {
			return null
		}

		const stored = window.localStorage.getItem("mit.session")
		return stored ? JSON.parse(stored) : null
	})

	const viewer = useQuery(api.auth.viewer, {
		sessionToken: session?.token,
	})

	const logout = useMutation(api.auth.logout)

	useEffect(() => {
		if (session) {
			window.localStorage.setItem("mit.session", JSON.stringify(session))
		} else {
			window.localStorage.removeItem("mit.session")
		}
	}, [session])

	if (!session || viewer === null) {
		return <AuthScreen onSession={setSession} />
	}

	return (
		<Board
			sessionToken={session.token}
			username={viewer?.username ?? session.user.username}
			onLogout={async () => {
				await logout({ sessionToken: session.token })
				setSession(null)
			}}
		/>
	)
}

function AuthScreen({ onSession }: { onSession: (session: Session) => void }) {
	const login = useAction(api.auth.login)
	const register = useAction(api.auth.register)
	const [mode, setMode] = useState<"login" | "register">("login")
	const [error, setError] = useState<string | null>(null)

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError(null)
		const form = new FormData(event.currentTarget)
		const username = String(form.get("username") ?? "")
		const password = String(form.get("password") ?? "")

		try {
			const result =
				mode === "login"
					? await login({ username, password })
					: await register({ username, password })
			onSession(result)
		} catch (error) {
			setError(error instanceof Error ? error.message : "Authentication failed")
		}
	}

	return (
		<main className="grid min-h-screen place-items-center bg-zinc-100 p-6 text-zinc-950">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Multiplayer Issue Tracker</CardTitle>
					<p className="text-sm text-zinc-500">
						Sign in to join the shared local Convex workspace.
					</p>
				</CardHeader>
				<CardContent>
					<div className="mb-4 grid grid-cols-2 rounded-md bg-zinc-100 p-1">
						<Button
							type="button"
							variant={mode === "login" ? "default" : "ghost"}
							onClick={() => setMode("login")}
						>
							Sign in
						</Button>
						<Button
							type="button"
							variant={mode === "register" ? "default" : "ghost"}
							onClick={() => setMode("register")}
						>
							Register
						</Button>
					</div>
					<form className="space-y-4" onSubmit={submit}>
						<div className="space-y-2">
							<Label htmlFor="username">Username</Label>
							<Input
								id="username"
								name="username"
								autoComplete="username"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete={
									mode === "login" ? "current-password" : "new-password"
								}
								required
							/>
						</div>
						{error ? <p className="text-sm text-red-600">{error}</p> : null}
						<Button className="w-full" type="submit">
							{mode === "login" ? "Sign in" : "Create account"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	)
}

function Board({
	sessionToken,
	username,
	onLogout,
}: {
	sessionToken: string
	username: string
	onLogout: () => void
}) {
	const board = useQuery(api.issues.list) as BoardData | undefined
	const seedDefaults = useMutation(api.issues.seedDefaults)
	const createIssue = useMutation(api.issues.create)
	const createColumn = useMutation(api.issues.createColumn)
	const moveIssue = useMutation(api.issues.move)
	const addAttachment = useMutation(api.issues.addAttachment)
	const [selectedStatus, setSelectedStatus] = useState<Id<"columns"> | null>(
		null,
	)

	useEffect(() => {
		void seedDefaults()
	}, [seedDefaults])

	const firstColumn = board?.columns[0]?._id
	const newIssueStatus = selectedStatus ?? firstColumn

	async function submitIssue(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!newIssueStatus) {
			return
		}

		const form = new FormData(event.currentTarget)
		await createIssue({
			sessionToken,
			title: String(form.get("title") ?? ""),
			description: String(form.get("description") ?? ""),
			assignee: String(form.get("assignee") ?? "") || undefined,
			statusId: newIssueStatus,
		})
		event.currentTarget.reset()
	}

	async function submitColumn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		await createColumn({ sessionToken, title: String(form.get("title") ?? "") })
		event.currentTarget.reset()
	}

	return (
		<main className="min-h-screen bg-zinc-100 text-zinc-950">
			<header className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
					<div>
						<h1 className="text-lg font-semibold">Multiplayer Issue Tracker</h1>
						<p className="text-sm text-zinc-500">Connected as {username}</p>
					</div>
					<Button variant="outline" onClick={onLogout}>
						<LogOut className="size-4" />
						Sign out
					</Button>
				</div>
			</header>

			<div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_1fr]">
				<aside className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>New issue</CardTitle>
						</CardHeader>
						<CardContent>
							<form className="space-y-3" onSubmit={submitIssue}>
								<Input name="title" placeholder="Title" required />
								<Textarea name="description" placeholder="Description" />
								<Input name="assignee" placeholder="Assignee" />
								<select
									className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
									value={newIssueStatus ?? ""}
									onChange={(event) =>
										setSelectedStatus(event.target.value as Id<"columns">)
									}
								>
									{board?.columns.map((column) => (
										<option key={column._id} value={column._id}>
											{column.title}
										</option>
									))}
								</select>
								<Button className="w-full" type="submit">
									<Plus className="size-4" />
									Create issue
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Add row</CardTitle>
						</CardHeader>
						<CardContent>
							<form className="flex gap-2" onSubmit={submitColumn}>
								<Input name="title" placeholder="Status name" required />
								<Button size="icon" aria-label="Add status" type="submit">
									<Plus className="size-4" />
								</Button>
							</form>
						</CardContent>
					</Card>
				</aside>

				<section className="overflow-x-auto">
					<div className="grid min-w-[960px] grid-cols-5 gap-3">
						{board?.columns.map((column) => {
							const issues = board.issues.filter(
								(issue) => issue.statusId === column._id,
							)
							return (
								<div key={column._id} className="space-y-3">
									<div className="flex items-center justify-between">
										<h2 className="text-sm font-semibold">{column.title}</h2>
										<Badge>{issues.length}</Badge>
									</div>
									<div className="space-y-3">
										{issues.map((issue) => (
											<IssueCard
												key={issue._id}
												issue={issue}
												columns={board.columns}
												onMove={(statusId) =>
													moveIssue({
														sessionToken,
														issueId: issue._id,
														statusId,
													})
												}
												onAttach={async (file) => {
													const upload = new FormData()
													upload.set("file", file)
													upload.set("issueId", issue._id)
													const response = await fetch("/api/upload", {
														method: "POST",
														body: upload,
													})
													if (!response.ok) {
														throw new Error(await response.text())
													}
													const attachment = await response.json()
													await addAttachment({
														sessionToken,
														issueId: issue._id,
														...attachment,
													})
												}}
											/>
										))}
									</div>
								</div>
							)
						})}
					</div>
				</section>
			</div>
		</main>
	)
}

function IssueCard({
	issue,
	columns,
	onMove,
	onAttach,
}: {
	issue: Doc<"issues"> & { attachments: Array<Doc<"attachments">> }
	columns: Array<Doc<"columns">>
	onMove: (statusId: Id<"columns">) => Promise<unknown>
	onAttach: (file: File) => Promise<void>
}) {
	const [uploading, setUploading] = useState(false)
	const attachmentCount = useMemo(
		() => issue.attachments.length,
		[issue.attachments],
	)

	return (
		<Card className="rounded-md">
			<CardHeader className="p-3">
				<CardTitle className="text-sm leading-snug">{issue.title}</CardTitle>
				{issue.assignee ? <Badge>{issue.assignee}</Badge> : null}
			</CardHeader>
			<CardContent className="space-y-3 p-3 pt-0">
				<p className="whitespace-pre-wrap text-sm text-zinc-600">
					{issue.description}
				</p>
				<select
					className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs"
					value={issue.statusId}
					onChange={(event) => onMove(event.target.value as Id<"columns">)}
				>
					{columns.map((column) => (
						<option key={column._id} value={column._id}>
							{column.title}
						</option>
					))}
				</select>
				<label
					className={cn(
						"flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-medium hover:bg-zinc-50",
						uploading && "cursor-wait opacity-70",
					)}
				>
					<Upload className="size-4" />
					{uploading ? "Uploading" : "Attach image"}
					<input
						className="sr-only"
						type="file"
						accept="image/*"
						disabled={uploading}
						onChange={async (event) => {
							const file = event.target.files?.[0]
							if (!file) {
								return
							}
							setUploading(true)
							try {
								await onAttach(file)
							} finally {
								setUploading(false)
								event.target.value = ""
							}
						}}
					/>
				</label>
				{attachmentCount > 0 ? (
					<div className="flex items-center gap-2 text-xs text-zinc-500">
						<ImageIcon className="size-3.5" />
						{attachmentCount} image{attachmentCount === 1 ? "" : "s"}
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
