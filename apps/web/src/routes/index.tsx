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
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAction, useMutation, useQuery } from "convex/react"
import {
	ImageIcon,
	LogOut,
	MessageSquare,
	PanelTopOpen,
	Pencil,
	Plus,
	Upload,
	X,
} from "lucide-react"
import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"

type SearchState = {
	issue?: string
	create?: boolean
}

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): SearchState => ({
		issue: typeof search.issue === "string" ? search.issue : undefined,
		create: search.create === true || search.create === "true" || undefined,
	}),
	component: Home,
})

type Session = {
	token: string
	user: {
		username: string
	}
}

type BoardIssue = Doc<"issues"> & {
	attachments: Array<Doc<"attachments">>
	comments: Array<Doc<"comments">>
	editingPresence: Array<Doc<"editingPresence">>
}

type BoardData = {
	columns: Array<Doc<"columns">>
	issues: Array<BoardIssue>
}

type UserOption = Pick<Doc<"users">, "_id" | "username">

function Home() {
	const [session, setSession] = useState<Session | null>(null)

	const viewer = useQuery(api.auth.viewer, {
		sessionToken: session?.token,
	})
	const logout = useMutation(api.auth.logout)

	useEffect(() => {
		const stored = window.localStorage.getItem("mit.session")
		if (stored) {
			setSession(JSON.parse(stored))
		}
	}, [])

	useEffect(() => {
		if (!session) {
			return
		}

		window.localStorage.setItem("mit.session", JSON.stringify(session))
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
	const search = Route.useSearch()
	const navigate = useNavigate({ from: "/" })
	const board = useQuery(api.issues.list) as BoardData | undefined
	const users = (useQuery(api.auth.listUsers) ?? []) as Array<UserOption>
	const seedDefaults = useMutation(api.issues.seedDefaults)
	const createIssue = useMutation(api.issues.create)
	const createColumn = useMutation(api.issues.createColumn)
	const renameColumn = useMutation(api.issues.renameColumn)
	const moveIssue = useMutation(api.issues.move)
	const updateIssue = useMutation(api.issues.update)
	const addAttachment = useMutation(api.issues.addAttachment)
	const addComment = useMutation(api.issues.addComment)
	const heartbeatEditing = useMutation(api.issues.heartbeatEditing)
	const clearEditing = useMutation(api.issues.clearEditing)
	const [draggedIssueId, setDraggedIssueId] = useState<Id<"issues"> | null>(
		null,
	)
	const [clientId, setClientId] = useState<string | null>(null)

	useEffect(() => {
		void seedDefaults()
	}, [seedDefaults])

	useEffect(() => {
		const existing = window.sessionStorage.getItem("mit.clientId")
		if (existing) {
			setClientId(existing)
			return
		}

		const next = crypto.randomUUID()
		window.sessionStorage.setItem("mit.clientId", next)
		setClientId(next)
	}, [])

	const selectedIssue = useMemo(
		() => board?.issues.find((issue) => issue._id === search.issue),
		[board?.issues, search.issue],
	)

	const firstColumn = board?.columns[0]?._id

	const heartbeatSelectedIssue = useCallback(
		(fields: Array<string>) => {
			if (!clientId || !selectedIssue) {
				return Promise.resolve(null)
			}

			return heartbeatEditing({
				sessionToken,
				issueId: selectedIssue._id,
				clientId,
				fields,
			})
		},
		[clientId, heartbeatEditing, selectedIssue, sessionToken],
	)

	const clearSelectedIssueEditing = useCallback(() => {
		if (!clientId || !selectedIssue) {
			return Promise.resolve(null)
		}

		return clearEditing({
			sessionToken,
			issueId: selectedIssue._id,
			clientId,
		})
	}, [clearEditing, clientId, selectedIssue, sessionToken])

	function closeModal() {
		void navigate({ search: {} })
	}

	async function uploadImage(issueId: Id<"issues">, file: File) {
		const upload = new FormData()
		upload.set("file", file)
		upload.set("issueId", issueId)
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
			issueId,
			...attachment,
		})
	}

	async function submitColumn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		await createColumn({
			sessionToken,
			title: String(form.get("title") ?? ""),
		})
		event.currentTarget.reset()
	}

	return (
		<main className="min-h-screen bg-zinc-100 text-zinc-950">
			<header className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
					<div>
						<h1 className="text-lg font-semibold">Multiplayer Issue Tracker</h1>
						<p className="text-sm text-zinc-500">Connected as {username}</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							onClick={() => navigate({ search: { create: true } })}
						>
							<Plus className="size-4" />
							New issue
						</Button>
						<Button variant="outline" onClick={onLogout}>
							<LogOut className="size-4" />
							Sign out
						</Button>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-4 py-4">
				<form className="mb-4 flex max-w-md gap-2" onSubmit={submitColumn}>
					<Input name="title" placeholder="Add custom column" required />
					<Button type="submit" variant="secondary">
						<PanelTopOpen className="size-4" />
						Add column
					</Button>
				</form>

				<section className="overflow-x-auto">
					<div className="flex min-h-[70vh] gap-3">
						{board?.columns.map((column) => {
							const issues = board.issues.filter(
								(issue) => issue.statusId === column._id,
							)
							return (
								<KanbanColumn
									key={column._id}
									column={column}
									issues={issues}
									draggedIssueId={draggedIssueId}
									onDragStart={setDraggedIssueId}
									onDropIssue={async (statusId) => {
										if (!draggedIssueId) {
											return
										}
										await moveIssue({
											sessionToken,
											issueId: draggedIssueId,
											statusId,
										})
										setDraggedIssueId(null)
									}}
									onOpenIssue={(issueId) =>
										navigate({ search: { issue: issueId } })
									}
									onRename={async (title) =>
										renameColumn({
											sessionToken,
											columnId: column._id,
											title,
										})
									}
								/>
							)
						})}
					</div>
				</section>
			</div>

			{search.create && firstColumn ? (
				<CreateIssueModal
					columns={board?.columns ?? []}
					users={users}
					defaultStatusId={firstColumn}
					onClose={closeModal}
					onCreate={async (input) => {
						const issueId = await createIssue({
							sessionToken,
							...input,
						})
						void navigate({ search: { issue: issueId } })
					}}
				/>
			) : null}

			{selectedIssue ? (
				<IssueDetailModal
					issue={selectedIssue}
					users={users}
					clientId={clientId}
					onClose={closeModal}
					onUpdate={(input) =>
						updateIssue({
							sessionToken,
							issueId: selectedIssue._id,
							...input,
						})
					}
					onUpload={(file) => uploadImage(selectedIssue._id, file)}
					onComment={(body) =>
						addComment({
							sessionToken,
							issueId: selectedIssue._id,
							body,
						})
					}
					onHeartbeat={heartbeatSelectedIssue}
					onClearEditing={clearSelectedIssueEditing}
				/>
			) : null}
		</main>
	)
}

function KanbanColumn({
	column,
	issues,
	draggedIssueId,
	onDragStart,
	onDropIssue,
	onOpenIssue,
	onRename,
}: {
	column: Doc<"columns">
	issues: Array<BoardIssue>
	draggedIssueId: Id<"issues"> | null
	onDragStart: (issueId: Id<"issues">) => void
	onDropIssue: (statusId: Id<"columns">) => Promise<void>
	onOpenIssue: (issueId: Id<"issues">) => void
	onRename: (title: string) => Promise<unknown>
}) {
	const [title, setTitle] = useState(column.title)

	useEffect(() => {
		setTitle(column.title)
	}, [column.title])

	return (
		<section
			aria-label={`${column.title} column`}
			className={cn(
				"w-72 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3",
				draggedIssueId && "border-zinc-300 bg-white",
			)}
			onDragOver={(event) => event.preventDefault()}
			onDrop={() => onDropIssue(column._id)}
		>
			<div className="mb-3 flex items-center gap-2">
				<Input
					className="h-8 border-transparent bg-transparent px-1 font-semibold focus-visible:bg-white"
					value={title}
					aria-label={`Rename ${column.title}`}
					onChange={(event) => setTitle(event.target.value)}
					onBlur={() => {
						if (title.trim() && title !== column.title) {
							void onRename(title.trim())
						}
					}}
				/>
				<Badge>{issues.length}</Badge>
			</div>
			<div className="space-y-3">
				{issues.map((issue) => (
					<IssueCard
						key={issue._id}
						issue={issue}
						onOpen={() => onOpenIssue(issue._id)}
						onDragStart={() => onDragStart(issue._id)}
					/>
				))}
			</div>
		</section>
	)
}

function IssueCard({
	issue,
	onOpen,
	onDragStart,
}: {
	issue: BoardIssue
	onOpen: () => void
	onDragStart: () => void
}) {
	return (
		<Card
			className="cursor-grab rounded-md active:cursor-grabbing"
			draggable
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = "move"
				event.dataTransfer.setData("text/plain", issue._id)
				onDragStart()
			}}
			onClick={onOpen}
			role="button"
			tabIndex={0}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					onOpen()
				}
			}}
		>
			<CardHeader className="p-3">
				<CardTitle className="text-sm leading-snug">{issue.title}</CardTitle>
				{issue.assignee ? <Badge>{issue.assignee}</Badge> : null}
			</CardHeader>
			<CardContent className="space-y-3 p-3 pt-0">
				<p className="line-clamp-3 whitespace-pre-wrap text-sm text-zinc-600">
					{issue.description || "No description"}
				</p>
				{issue.editingPresence.length > 0 ? (
					<Badge className="border-amber-200 bg-amber-50 text-amber-800">
						<Pencil className="size-3" />
						{issue.editingPresence.length} editing
					</Badge>
				) : null}
				<div className="flex items-center gap-3 text-xs text-zinc-500">
					<span className="flex items-center gap-1">
						<MessageSquare className="size-3.5" />
						{issue.comments.length}
					</span>
					<span className="flex items-center gap-1">
						<ImageIcon className="size-3.5" />
						{issue.attachments.length}
					</span>
				</div>
			</CardContent>
		</Card>
	)
}

function CreateIssueModal({
	columns,
	users,
	defaultStatusId,
	onClose,
	onCreate,
}: {
	columns: Array<Doc<"columns">>
	users: Array<UserOption>
	defaultStatusId: Id<"columns">
	onClose: () => void
	onCreate: (input: {
		title: string
		description: string
		statusId: Id<"columns">
		assignee?: string
	}) => Promise<void>
}) {
	const [statusId, setStatusId] = useState<Id<"columns">>(defaultStatusId)

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		await onCreate({
			title: String(form.get("title") ?? ""),
			description: String(form.get("description") ?? ""),
			assignee: String(form.get("assignee") ?? "") || undefined,
			statusId,
		})
	}

	return (
		<Modal title="New issue" onClose={onClose}>
			<form className="space-y-4" onSubmit={submit}>
				<div className="space-y-2">
					<Label htmlFor="new-title">Title</Label>
					<Input id="new-title" name="title" required />
				</div>
				<div className="space-y-2">
					<Label htmlFor="new-description">Description</Label>
					<Textarea id="new-description" name="description" />
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="new-assignee">Assignee</Label>
						<AssigneeInput id="new-assignee" name="assignee" users={users} />
					</div>
					<div className="space-y-2">
						<Label>Status</Label>
						<div className="flex flex-wrap gap-2">
							{columns.map((column) => (
								<Button
									key={column._id}
									type="button"
									size="sm"
									variant={statusId === column._id ? "default" : "outline"}
									onClick={() => setStatusId(column._id)}
								>
									{column.title}
								</Button>
							))}
						</div>
					</div>
				</div>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit">Create issue</Button>
				</div>
			</form>
		</Modal>
	)
}

function IssueDetailModal({
	issue,
	users,
	clientId,
	onClose,
	onUpdate,
	onUpload,
	onComment,
	onHeartbeat,
	onClearEditing,
}: {
	issue: BoardIssue
	users: Array<UserOption>
	clientId: string | null
	onClose: () => void
	onUpdate: (input: {
		title?: string
		description?: string
		assignee?: string
	}) => Promise<unknown>
	onUpload: (file: File) => Promise<void>
	onComment: (body: string) => Promise<unknown>
	onHeartbeat: (fields: Array<string>) => Promise<unknown>
	onClearEditing: () => Promise<unknown>
}) {
	const [uploading, setUploading] = useState(false)
	const [title, setTitle] = useState(issue.title)
	const [description, setDescription] = useState(issue.description)
	const [assignee, setAssignee] = useState(issue.assignee ?? "")
	const [isEditing, setIsEditing] = useState(false)
	const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false)

	const otherEditors = issue.editingPresence.filter(
		(presence) => presence.clientId !== clientId,
	)

	useEffect(() => {
		if (isEditing) {
			setHasRemoteUpdate(true)
			return
		}

		setTitle(issue.title)
		setDescription(issue.description)
		setAssignee(issue.assignee ?? "")
		setHasRemoteUpdate(false)
	}, [issue.title, issue.description, issue.assignee, isEditing])

	useEffect(() => {
		if (!isEditing) {
			return
		}

		const fields = ["title", "description", "assignee"]
		void onHeartbeat(fields)
		const intervalId = window.setInterval(() => {
			void onHeartbeat(fields)
		}, 5_000)

		return () => window.clearInterval(intervalId)
	}, [isEditing, onHeartbeat])

	useEffect(() => {
		return () => {
			void onClearEditing()
		}
	}, [onClearEditing])

	function markEditing() {
		setIsEditing(true)
	}

	async function submitDetails(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		await onUpdate({
			title,
			description,
			assignee,
		})
		setIsEditing(false)
		setHasRemoteUpdate(false)
		await onClearEditing()
	}

	async function submitComment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		const body = String(form.get("body") ?? "").trim()
		if (!body) {
			return
		}
		await onComment(body)
		event.currentTarget.reset()
	}

	return (
		<Modal title="Issue detail" onClose={onClose} wide>
			{otherEditors.length > 0 ? (
				<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
					{otherEditors.length} active editor
					{otherEditors.length === 1 ? "" : "s"}:{" "}
					{otherEditors.map((editor) => editor.username).join(", ")}
				</div>
			) : null}
			{hasRemoteUpdate ? (
				<div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
					This issue changed in another tab while you are editing. Save to keep
					your draft, or close and reopen to load the latest version.
				</div>
			) : null}
			<div className="grid gap-5 lg:grid-cols-[1fr_260px]">
				<form className="space-y-4" onSubmit={submitDetails}>
					<div className="space-y-2">
						<Label htmlFor="detail-title">Title</Label>
						<Input
							id="detail-title"
							name="title"
							value={title}
							onFocus={markEditing}
							onChange={(event) => {
								markEditing()
								setTitle(event.target.value)
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="detail-description">Description</Label>
						<Textarea
							id="detail-description"
							name="description"
							value={description}
							onFocus={markEditing}
							onChange={(event) => {
								markEditing()
								setDescription(event.target.value)
							}}
							className="min-h-36"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="detail-assignee">Assignee</Label>
						<AssigneeInput
							id="detail-assignee"
							name="assignee"
							users={users}
							value={assignee}
							onFocus={markEditing}
							onChange={(event) => {
								markEditing()
								setAssignee(event.target.value)
							}}
						/>
					</div>
					<Button type="submit">Save details</Button>
				</form>

				<aside className="space-y-4">
					<div className="space-y-2">
						<Label>Images</Label>
						<label
							className={cn(
								"flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-medium hover:bg-zinc-50",
								uploading && "cursor-wait opacity-70",
							)}
						>
							<Upload className="size-4" />
							{uploading ? "Uploading" : "Upload image"}
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
										await onUpload(file)
									} finally {
										setUploading(false)
										event.target.value = ""
									}
								}}
							/>
						</label>
						<div className="space-y-2">
							{issue.attachments.map((attachment) => (
								<a
									key={attachment._id}
									className="block rounded-md border border-zinc-200 p-2 text-sm text-zinc-700 hover:bg-zinc-50"
									href={`/api/object?key=${encodeURIComponent(attachment.key)}`}
									target="_blank"
									rel="noreferrer"
								>
									{attachment.fileName}
								</a>
							))}
						</div>
					</div>
				</aside>
			</div>

			<section className="mt-5 border-t border-zinc-200 pt-4">
				<h3 className="mb-3 text-sm font-semibold">Comments</h3>
				<div className="space-y-3">
					{issue.comments.map((comment) => (
						<div key={comment._id} className="rounded-md bg-zinc-50 p-3">
							<div className="text-xs font-medium text-zinc-500">
								{comment.authorUsername}
							</div>
							<p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
								{comment.body}
							</p>
						</div>
					))}
				</div>
				<form className="mt-3 flex gap-2" onSubmit={submitComment}>
					<Input name="body" placeholder="Add a comment" required />
					<Button type="submit">Comment</Button>
				</form>
			</section>
		</Modal>
	)
}

function AssigneeInput({
	users,
	id,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
	users: Array<UserOption>
}) {
	const listId = `${id}-users`
	return (
		<>
			<Input id={id} list={listId} {...props} />
			<datalist id={listId}>
				{users.map((user) => (
					<option key={user._id} value={user.username} />
				))}
			</datalist>
		</>
	)
}

function Modal({
	title,
	children,
	onClose,
	wide = false,
}: {
	title: string
	children: React.ReactNode
	onClose: () => void
	wide?: boolean
}) {
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
			<div
				className={cn(
					"max-h-[90vh] w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl",
					wide ? "max-w-4xl" : "max-w-2xl",
				)}
			>
				<div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
					<h2 className="font-semibold">{title}</h2>
					<Button type="button" variant="ghost" size="icon" onClick={onClose}>
						<X className="size-4" />
						<span className="sr-only">Close</span>
					</Button>
				</div>
				<div className="p-5">{children}</div>
			</div>
		</div>
	)
}
