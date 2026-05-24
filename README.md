# Multiplayer Issue Tracker

A local-first multiplayer kanban issue tracker built with TanStack Start, Convex, TypeScript, Vitest, Biome, shadcn-style UI primitives, RustFS object storage, and an MCP server for agent issue mutation.

## Stack

- `apps/web`: TanStack Start React app with Convex real-time sync.
- `packages/ui`: shared shadcn-style UI primitives.
- `packages/mcp`: stdio MCP server exposing issue tools for agents.
- `docker-compose.yml`: local RustFS object storage on ports `9000` and `9001`.
- `mise.toml`: pinned binaries and common tasks.
- `lefthook.yml`: pre-commit runs Biome, Vitest, and Fallow.

## Local Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts RustFS, the local Convex backend, and the TanStack Start app. The web app runs at the Vite URL printed by the command, usually `http://localhost:3000`.

The app uses username/password auth for local development. Register a user in the browser, then create and move issues on the board. Default statuses are:

- Backlog
- Ready for development
- In progress
- Ready for QA
- Done

Custom status rows can be added from the sidebar. Image attachments are uploaded to the local RustFS bucket configured in `.env.example`.

## MCP

Build the MCP server:

```sh
pnpm --filter @mit/mcp build
```

Run it with an authenticated local session token:

```sh
CONVEX_URL=http://127.0.0.1:3210 MIT_SESSION_TOKEN=<token> pnpm --filter @mit/mcp dev
```

The server exposes:

- `list_issues`
- `create_issue`
- `update_issue`
- `move_issue`

For now, copy the `token` field from the `mit.session` JSON value in browser local storage after signing in.

## Quality

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm fallow
```

The pre-commit hook runs Biome, Vitest, and Fallow through Lefthook.
