# Implementation Plan: Ontos v0

## Overview

Build a live, persistent graph runtime in six phases. Each phase delivers working, testable functionality. Phases 1–3 prove the core model (runtime + traits + messages). Phase 4 proves computational nodes. Phase 5 adds history tools. Phase 6 delivers the HTTP API and live web UI.

## Architecture Decisions

- **Kernel is pure.** No HTTP, no CLI, no React concerns. The shell API is the only outward surface.
- **Storage interface first.** All persistence goes through `IStore`. JSON adapter in v0; swap later without touching kernel logic.
- **Effects are the seam.** Trait handlers produce effects; the runtime interprets them. This boundary must stay clean.
- **SSE for live UI updates.** The HTTP server emits revision events; React Flow subscribes. Simpler than WebSockets for v0.
- **Revisions are full snapshots.** No incremental deltas in v0. Simpler to implement; revisit if storage becomes a concern.

## Dependency Graph

```
Monorepo scaffold
  └── Core types
        └── Storage interface + JSON adapter
              └── Revision store + branch tracking
                    ├── Node/edge CRUD
                    │     └── Log entries
                    │           └── Shell API
                    │                 ├── CLI + REPL  ─────────────────────────────┐
                    │                 └── HTTP API server                          │
                    │                       ├── SSE emitter                        │
                    │                       └── React UI (React Flow + Inspector)  │
                    │                                                               │
                    └── Trait registry + package loader                            │
                          └── Message dispatch                                     │
                                └── Effect interpreter                             │
                                      ├── Reading package ←── bootstrap script ───┘
                                      ├── Net/server package
                                      └── History tools (diff, fork, squash)
```

---

## Phase 1: Monorepo + Runtime Core

### Task 1: Monorepo scaffold

**Description:** Initialize the pnpm monorepo with three workspaces (`kernel`, `app`, `packages`), shared TypeScript config, ESLint, Prettier, and Vitest.

**Acceptance criteria:**
- [ ] `pnpm install` succeeds from root
- [ ] `pnpm test` runs (zero tests, zero failures)
- [ ] `pnpm build` compiles all workspaces
- [ ] `pnpm lint` runs ESLint across all workspaces
- [ ] TypeScript strict mode enabled in all workspaces

**Verification:** `pnpm install && pnpm build && pnpm test && pnpm lint`

**Dependencies:** None

**Files:**
- `pnpm-workspace.yaml`
- `package.json` (root)
- `tsconfig.base.json`
- `kernel/package.json`, `kernel/tsconfig.json`
- `app/package.json`, `app/tsconfig.json`
- `packages/package.json`, `packages/tsconfig.json`
- `.eslintrc.cjs`, `.prettierrc`

**Size:** M

---

### Task 2: Core data model types

**Description:** Define all core types in `kernel/src/types.ts` — `NodeRecord`, `EdgeRecord`, `WorldRevision`, `Message`, `Effect`, `WorldOp`, `LogEntry`, `Branch`, and their ID aliases.

**Acceptance criteria:**
- [ ] All types from the SPEC data model section are defined
- [ ] `Effect` is a discriminated union
- [ ] `WorldOp` / `DeveloperOperation` are discriminated unions
- [ ] `TraitDefinition`, `MessageHandler`, `TraitContext`, `HandlerResult` are defined
- [ ] No runtime code — types only

**Verification:** `pnpm --filter kernel build` with zero type errors

**Dependencies:** Task 1

**Files:**
- `kernel/src/types.ts`

**Size:** S

---

### Task 3: Storage interface + JSON file adapter

**Description:** Define `IStore` (interface for reading/writing world data) and implement `JsonFileStore` that persists to a directory of JSON files. One file per world.

**Acceptance criteria:**
- [ ] `IStore` interface covers: load world, save world, list worlds
- [ ] `JsonFileStore` reads/writes `<dataDir>/<worldName>.json`
- [ ] `JsonFileStore` creates the data directory if it doesn't exist
- [ ] Unit tests cover: save → load round trip, missing file returns null

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 2

**Files:**
- `kernel/src/store/interface.ts`
- `kernel/src/store/json-file-store.ts`
- `kernel/test/store/json-file-store.test.ts`

**Size:** M

---

### Task 4: Revision store + branch tracking

**Description:** Implement `RevisionStore` — create a world (with bootstrap kernel nodes), load the current revision for a branch, save a new revision, advance the branch head.

**Acceptance criteria:**
- [ ] `createWorld(name)` produces a world with a `main` branch and an initial revision containing kernel nodes (`world-root`, `system.log`, `system.registry`)
- [ ] `getCurrentRevision(worldName, branch)` returns the head revision
- [ ] `saveRevision(revision)` persists and advances the branch head
- [ ] Loading a world after process restart returns the correct head revision
- [ ] Unit tests cover: create, load, save, branch head advancement

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 3

**Files:**
- `kernel/src/world/revision-store.ts`
- `kernel/src/world/bootstrap.ts`
- `kernel/test/world/revision-store.test.ts`

**Size:** M

---

### Task 5: Node + edge CRUD operations

**Description:** Implement pure functions that apply `WorldOp` operations to a `WorldRevision` to produce a new revision — create/patch node, create/remove edge, express/remove trait.

**Acceptance criteria:**
- [ ] `applyOp(op, revision)` handles all `WorldOp` variants
- [ ] `applyOp` is a pure function — returns a new revision object, never mutates
- [ ] Applying `create_node` gives the node a derived `url` (`/worlds/<world>/nodes/<slug>`)
- [ ] Unrecognized op type hits `satisfies never` and throws
- [ ] Unit tests cover every op variant

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 4

**Files:**
- `kernel/src/node/ops.ts`
- `kernel/test/node/ops.test.ts`

**Size:** M

---

### Task 6: Log entry recording

**Description:** Implement `createLogEntry` that builds a `LogEntry` from a cause (message, operation, or runtime), the effects produced, and the ops applied. Wire it into the revision save path so every change has a log entry.

**Acceptance criteria:**
- [ ] Every call to `saveRevision` requires a `LogEntry`
- [ ] `LogEntry` records: cause, effects, appliedOps, parentRevisionId
- [ ] Log entries are stored in the world JSON alongside revisions
- [ ] `getLogEntries(worldName, branch)` returns the ordered log
- [ ] Unit tests cover log entry creation and retrieval

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 5

**Files:**
- `kernel/src/log/log-entry.ts`
- `kernel/src/world/revision-store.ts` (update save path)
- `kernel/test/log/log-entry.test.ts`

**Size:** S

---

### Checkpoint 1: Runtime Core
- [ ] `pnpm --filter kernel test` — all tests pass
- [ ] `pnpm build` — zero type errors
- [ ] Can create a world, create a node, persist, reload — verified in a test

---

## Phase 2: Trait + Message System

### Task 7: Trait registry + package loader

**Description:** Implement `PackageLoader` that dynamically `import()`s local TypeScript/JS packages and registers their `TraitDefinition` exports. Implement `TraitRegistry` that resolves a `TraitUri` to a `TraitDefinition`.

**Acceptance criteria:**
- [ ] `loadPackage(path)` imports the module and registers all exported trait definitions
- [ ] `TraitRegistry.get(uri)` returns the correct `TraitDefinition` or throws if not found
- [ ] Duplicate URI registration throws
- [ ] Unit tests cover: load, resolve, duplicate, missing

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 2

**Files:**
- `kernel/src/trait/registry.ts`
- `kernel/src/trait/loader.ts`
- `kernel/test/trait/registry.test.ts`

**Size:** M

---

### Task 8: Message dispatch

**Description:** Implement `dispatchMessage(nodeId, message, revision, traitRegistry)` — resolve the node's expressed traits, find the handler for the message type, call it with `TraitContext`, and return `HandlerResult`. Reject if two traits handle the same message.

**Acceptance criteria:**
- [ ] Resolves the correct handler from expressed traits
- [ ] Passes correct `TraitContext` (node, revision, now)
- [ ] Returns effects from handler
- [ ] Throws if no handler found for message type
- [ ] Throws if two expressed traits both handle the same message type
- [ ] Unit tests cover: dispatch, no handler, conflict

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 7, Task 5

**Files:**
- `kernel/src/message/dispatch.ts`
- `kernel/test/message/dispatch.test.ts`

**Size:** M

---

### Task 9: Effect interpreter

**Description:** Implement `interpretEffects(effects, revision, store, runtimeRegistry)` — process each effect type: `apply_op` mutates the working revision, `emit_message` queues a follow-up dispatch, `log` writes a log entry, `open_listener` / `close_listener` delegate to the runtime host, `schedule_message` registers with the scheduler. Enforce max cascade depth (10).

**Acceptance criteria:**
- [ ] `apply_op` effects are applied via `applyOp` in order
- [ ] `emit_message` effects are queued and dispatched after current effects resolve (BFS, not recursive)
- [ ] `log` effects write to the operation log
- [ ] `open_listener` / `close_listener` delegate to a `IRuntimeHost` interface (not implemented yet — use a stub)
- [ ] Cascade depth exceeding 10 throws `CascadeDepthError`
- [ ] Unhandled effect type hits `satisfies never` and throws
- [ ] Unit tests cover: apply_op, emit_message cascade, depth limit

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 8, Task 5

**Files:**
- `kernel/src/effect/interpreter.ts`
- `kernel/src/effect/types.ts` (IRuntimeHost interface)
- `kernel/test/effect/interpreter.test.ts`

**Size:** M

---

### Task 10: Shell API surface

**Description:** Implement `OntosShellApi` — the single interface the CLI/shell uses to talk to the kernel. Covers: `sendMessage`, `applyOp`, `previewMessage`, `getNode`, `listNodes`, `getRevision`, `getLog`, `forkBranch`. This wires together Tasks 4–9.

**Acceptance criteria:**
- [ ] `sendMessage(worldName, branch, nodeId, message)` dispatches, interprets effects, saves revision + log entry, returns new revision
- [ ] `previewMessage(...)` runs the full dispatch + effect interpretation but does NOT save — returns diff only
- [ ] `applyOp(worldName, branch, op)` applies a developer operation directly, saves revision + log entry
- [ ] `getNode(worldName, branch, nodeIdOrSlug)` returns the node from the current revision
- [ ] Integration tests cover the full `sendMessage` → new revision pipeline

**Verification:** `pnpm --filter kernel test` (integration tests)

**Dependencies:** Task 6, Task 9

**Files:**
- `kernel/src/api/shell-api.ts`
- `kernel/test/api/shell-api.test.ts` (integration)

**Size:** M

---

### Checkpoint 2: Trait + Message System
- [ ] `pnpm --filter kernel test` — all tests pass
- [ ] Integration test: load package → express trait → send message → new revision saved → log entry recorded

---

## Phase 3: CLI + Shell + Reading Example

### Task 11: CLI entry point + `ontos` binary

**Description:** Set up the `app` workspace with a `bin/ontos.ts` entry point. Wire `commander` (or similar) for subcommand routing: `serve`, `shell`, `repl`, `run`. The commands don't need to be fully implemented — just routed with stub handlers.

**Acceptance criteria:**
- [ ] `ontos --help` prints available commands
- [ ] `ontos <unknown>` prints an error and exits with non-zero code
- [ ] Binary is declared in `app/package.json` `bin` field
- [ ] `pnpm --filter app build` produces a runnable binary

**Verification:** `node dist/bin/ontos.js --help`

**Dependencies:** Task 10

**Files:**
- `app/src/cli/index.ts`
- `app/src/cli/commands/` (stub files)
- `app/package.json` (bin entry)

**Size:** S

---

### Task 12: Shell commands — world, branch, node, edge

**Description:** Implement shell commands for world/branch/node/edge inspection and manipulation, backed by the shell API.

**Acceptance criteria:**
- [ ] `world show` — prints current world name, branch, head revision ID
- [ ] `world history` — prints the log entries for the current branch
- [ ] `branch list` / `branch fork <from> <name>` — stubs that error gracefully (fork implemented in Phase 5)
- [ ] `node list` — prints all nodes in the current revision
- [ ] `node show <id|slug>` — prints node state, kinds, traits, url
- [ ] `node create --name <n> --kind <k> --slug <s>` — creates a node, prints new revision ID
- [ ] `edge list` / `edge create` / `edge remove` — create/remove edges

**Verification:** Manual REPL walkthrough creating a node and showing it

**Dependencies:** Task 11

**Files:**
- `app/src/shell/commands/world.ts`
- `app/src/shell/commands/branch.ts`
- `app/src/shell/commands/node.ts`
- `app/src/shell/commands/edge.ts`

**Size:** M

---

### Task 13: Shell commands — message, operation, package

**Description:** Implement message and operation shell commands.

**Acceptance criteria:**
- [ ] `message send <nodeIdOrSlug> <type> [--payload <json>]` — sends message, prints resulting revision
- [ ] `message preview <nodeIdOrSlug> <type>` — shows effects + diff without committing
- [ ] `op apply <type> [--payload <json>]` — applies a developer operation directly
- [ ] `pkg list` — lists loaded packages
- [ ] `pkg load <path>` — loads a package at runtime
- [ ] `trait inspect <uri>` — prints trait definition (handles, state spec)

**Verification:** Manual: `pkg load ./packages/reading/book && trait inspect pkg://reading/book@v1#reading.lifecycle`

**Dependencies:** Task 12

**Files:**
- `app/src/shell/commands/message.ts`
- `app/src/shell/commands/op.ts`
- `app/src/shell/commands/pkg.ts`

**Size:** M

---

### Task 14: `ontos repl` + `ontos shell`

**Description:** Implement the embedded REPL (`ontos repl` starts a local kernel + drops into an interactive shell) and the attached shell (`ontos shell` connects to a running server's shell API over HTTP).

**Acceptance criteria:**
- [ ] `ontos repl` starts readline loop, accepts shell commands, prints output
- [ ] `ontos repl` loads a world (creates one if none exists) on startup
- [ ] `ontos shell` connects to `http://localhost:<port>/shell` (stub endpoint for now — full impl in Phase 6)
- [ ] `exit` / Ctrl-D exits cleanly

**Verification:** `ontos repl` → `node list` → see kernel bootstrap nodes

**Dependencies:** Task 13

**Files:**
- `app/src/shell/repl.ts`
- `app/src/cli/commands/repl.ts`
- `app/src/cli/commands/shell.ts`

**Size:** M

---

### Task 15: Reading package (traits)

**Description:** Implement the three reading traits as an external package loadable by the runtime.

**Acceptance criteria:**
- [ ] `pkg://reading/book@v1#reading.lifecycle` trait — handles `mark_want_to_read`, `mark_active`, `mark_finished`, `mark_inactive`; owns `reading.lifecycle` state slice with `status`, `startedAt`, `finishedAt`
- [ ] `pkg://reading/list@v1#reading.list` trait — handles `add_book`, `remove_book`; produces edge ops
- [ ] `pkg://reading/query@v1#latestActiveBook` trait — handles `recompute`; produces a `set_node_state` effect with the latest active book node ID
- [ ] 100% handler coverage with Vitest unit tests

**Verification:** `pnpm --filter packages test`

**Dependencies:** Task 2 (types only)

**Files:**
- `packages/reading/book/trait.ts`
- `packages/reading/list/trait.ts`
- `packages/reading/query/trait.ts`
- `packages/reading/*/trait.test.ts`

**Size:** M

---

### Task 16: Bootstrap reading world script

**Description:** Write `scripts/bootstrap-reading-world.ts` that creates the reading world end-to-end: Book node, ReadingList node, trait expressions, edges, and a `DerivedValue` node for latest active book.

**Acceptance criteria:**
- [ ] `ontos run scripts/bootstrap-reading-world.ts` completes without errors
- [ ] After running: `node list` shows Book, ReadingList, DerivedValue nodes
- [ ] `node show paradise-lost` shows `reading.lifecycle.status: "want_to_read"`
- [ ] `message send paradise-lost mark_active` transitions status to `active`

**Verification:** Manual REPL walkthrough matching the reading domain walkthrough in SPEC.md

**Dependencies:** Task 14, Task 15

**Files:**
- `scripts/bootstrap-reading-world.ts`

**Size:** S

---

### Checkpoint 3: Reading Example End-to-End
- [ ] `ontos repl` → run bootstrap script → send messages → inspect revisions
- [ ] All kernel + packages tests pass
- [ ] The reading domain walkthrough from SPEC.md works exactly as described

---

## Phase 4: Computational Node

### Task 17: `IRuntimeHost` implementation + listener registry

**Description:** Implement the real `RuntimeHost` that handles `open_listener` and `close_listener` effects — actually binds TCP ports using Node's `net` module. Maintain a registry of active listeners.

**Acceptance criteria:**
- [ ] `open_listener` on a free port succeeds; listener registered by ID
- [ ] `open_listener` on a bound port → effect fails → failure log entry recorded, branch head NOT advanced
- [ ] `close_listener` closes the socket and removes from registry
- [ ] `runtime listeners` shell command prints active listeners (host, port, nodeId)

**Verification:** `ontos repl` → create server node → `message send api-server start_server` → `runtime listeners` shows port 3000

**Dependencies:** Task 9 (IRuntimeHost interface), Task 13

**Files:**
- `kernel/src/effect/runtime-host.ts`
- `app/src/shell/commands/runtime.ts`

**Size:** M

---

### Task 18: Net/server package (trait)

**Description:** Implement the `server.lifecycle` trait.

**Acceptance criteria:**
- [ ] `pkg://net/server@v1#server.lifecycle` trait — handles `start_server`, `stop_server`
- [ ] `start_server` returns: `apply_op` (set desired state to running) + `open_listener` effect
- [ ] `stop_server` returns: `apply_op` (set desired state to stopped) + `close_listener` effect
- [ ] 100% handler coverage with unit tests

**Verification:** `pnpm --filter packages test`

**Dependencies:** Task 2

**Files:**
- `packages/net/server/trait.ts`
- `packages/net/server/trait.test.ts`

**Size:** S

---

### Checkpoint 4: Computational Node
- [ ] `ontos repl` → create server node → `start_server` → `runtime listeners` shows active listener
- [ ] Port already bound → failure log entry, revision NOT advanced

---

## Phase 5: History Tools

### Task 19: Revision diff

**Description:** Implement `diffRevisions(revA, revB)` — returns added/modified/removed nodes and edges between two revisions.

**Acceptance criteria:**
- [ ] Returns `{ nodes: { added, modified, removed }, edges: { added, removed } }`
- [ ] `world diff <revA> <revB>` shell command prints a readable diff
- [ ] Unit tests cover: no change, node added, node state modified, node removed, edge added/removed

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 4

**Files:**
- `kernel/src/world/diff.ts`
- `app/src/shell/commands/world.ts` (add diff subcommand)
- `kernel/test/world/diff.test.ts`

**Size:** M

---

### Task 20: Branch fork + switch

**Description:** Implement branch forking (create a new branch from any revision) and branch switching (change active branch in the REPL session).

**Acceptance criteria:**
- [ ] `branch fork <revisionId> <newBranchName>` creates a new branch whose head is the given revision
- [ ] `branch switch <name>` updates the REPL session's active branch
- [ ] `branch list` shows all branches with their head revision IDs
- [ ] Unit tests cover: fork, list, switch to nonexistent branch throws

**Verification:** `pnpm --filter kernel test` + manual: fork, switch, `node list` shows correct state

**Dependencies:** Task 4, Task 14

**Files:**
- `kernel/src/world/revision-store.ts` (add fork)
- `app/src/shell/commands/branch.ts` (implement stubs)

**Size:** S

---

### Task 21: Revision squash

**Description:** Implement `squashRevisions(worldName, branch, fromRevId, toRevId)` — produce a new baseline revision from the `toRevId` snapshot, record squash metadata in the log, prune intermediate revisions.

**Acceptance criteria:**
- [ ] After squash, `getLogEntries` returns a squash marker + entries after `toRevId`
- [ ] World reloads correctly from squashed state
- [ ] `revision squash <fromRev> <toRev>` shell command works
- [ ] Unit tests cover: squash, reload after squash

**Verification:** `pnpm --filter kernel test`

**Dependencies:** Task 19

**Files:**
- `kernel/src/world/revision-store.ts` (add squash)
- `app/src/shell/commands/revision.ts`
- `kernel/test/world/squash.test.ts`

**Size:** M

---

### Checkpoint 5: History Tools
- [ ] Full history walkthrough: create nodes → diff two revisions → fork branch → squash → reload

---

## Phase 6: HTTP API + Web UI

### Task 22: Express HTTP API server

**Description:** Implement the HTTP API in `app/src/server/` — node CRUD, message send/preview, op apply, revision lookup, branch control, package inspection.

**Acceptance criteria:**
- [ ] `GET /worlds/:world/branches/:branch/nodes` — list nodes
- [ ] `GET /worlds/:world/branches/:branch/nodes/:id` — get node
- [ ] `POST /worlds/:world/branches/:branch/nodes/:id/message` — send message
- [ ] `POST /worlds/:world/branches/:branch/nodes/:id/message/preview` — preview
- [ ] `POST /worlds/:world/branches/:branch/ops` — apply developer op
- [ ] `GET /worlds/:world/branches/:branch/revisions` — list revisions
- [ ] `GET /worlds/:world/branches` — list branches
- [ ] All endpoints return JSON; errors return `{ error: string }` with appropriate status codes

**Verification:** `curl` smoke tests against a running server

**Dependencies:** Task 10

**Files:**
- `app/src/server/index.ts`
- `app/src/server/routes/nodes.ts`
- `app/src/server/routes/messages.ts`
- `app/src/server/routes/revisions.ts`
- `app/src/server/routes/branches.ts`

**Size:** L → split across 4 route files, each S/M

---

### Task 23: `ontos serve` + SSE endpoint

**Description:** Implement `ontos serve` — starts the runtime, HTTP API, and SSE endpoint. The SSE endpoint (`GET /events`) emits a `revision` event after every successful `sendMessage` or `applyOp`.

**Acceptance criteria:**
- [ ] `ontos serve` starts on a configurable port (default 3000)
- [ ] `GET /events` opens an SSE stream
- [ ] Every new revision emits `event: revision\ndata: <revisionId>\n\n` to all connected clients
- [ ] Server serves the built web UI from `dist/ui/` at `GET /`

**Verification:** `curl -N http://localhost:3000/events` → send a message → see revision event

**Dependencies:** Task 22, Task 11

**Files:**
- `app/src/server/sse.ts`
- `app/src/cli/commands/serve.ts`

**Size:** S

---

### Task 24: React + Vite scaffold + React Flow graph

**Description:** Set up the React + Vite project in `app/src/ui/`. Implement the main graph canvas showing world nodes as React Flow nodes and edges.

**Acceptance criteria:**
- [ ] Vite dev server starts with `pnpm --filter app dev`
- [ ] `pnpm --filter app build` produces `dist/ui/` with an `index.html`
- [ ] App fetches node/edge list from the HTTP API on load
- [ ] Nodes appear as labeled React Flow nodes; edges appear as React Flow edges
- [ ] Subscribes to SSE `/events`; re-fetches graph on each `revision` event
- [ ] Graph layout is automatic (React Flow's built-in layout or dagre)

**Verification:** `ontos serve` → open browser → see graph update after `message send` from shell

**Dependencies:** Task 23

**Files:**
- `app/src/ui/main.tsx`
- `app/src/ui/App.tsx`
- `app/src/ui/components/graph/WorldGraph.tsx`
- `app/src/ui/api/client.ts`
- `app/vite.config.ts`

**Size:** M

---

### Task 25: Node inspector panel

**Description:** Clicking a node in the graph opens an inspector panel showing: name, slug, URL, kinds, expressed traits, full state (namespaced), and revision history (log entries that touched this node).

**Acceptance criteria:**
- [ ] Clicking a node selects it and opens the inspector panel
- [ ] Panel shows all fields from `NodeRecord`
- [ ] State is rendered namespace by namespace (e.g., `reading.lifecycle` section)
- [ ] Log entries that touched the node are listed in reverse chronological order
- [ ] Panel closes when clicking background or pressing Escape

**Verification:** Manual: click Book node → see state, traits, and history

**Dependencies:** Task 24

**Files:**
- `app/src/ui/components/inspector/NodeInspector.tsx`
- `app/src/ui/components/inspector/StateSection.tsx`
- `app/src/ui/components/inspector/HistoryList.tsx`

**Size:** M

---

### Task 26: Embedded shell panel in UI

**Description:** Add a collapsible shell panel at the bottom of the UI. Commands typed in the panel are sent to the server's shell API endpoint (`POST /shell/exec`) and the output is displayed inline.

**Acceptance criteria:**
- [ ] Shell panel toggles open/closed with a keyboard shortcut (`` ` `` or `~`)
- [ ] Typing a command and pressing Enter sends it to `POST /shell/exec`
- [ ] Server executes the command via the shell API and returns stdout/stderr as JSON
- [ ] Output is rendered in the panel (monospace, scrollable)
- [ ] Graph updates live when a command produces a new revision (via SSE)

**Verification:** Open UI → type `node list` in shell panel → see nodes listed; type `message send paradise-lost mark_finished` → graph node updates

**Dependencies:** Task 25, Task 23

**Files:**
- `app/src/ui/components/shell/ShellPanel.tsx`
- `app/src/server/routes/shell.ts` (`POST /shell/exec`)

**Size:** M

---

### Checkpoint 6: Full v0 Complete
- [ ] `ontos serve` starts cleanly
- [ ] Browser shows live graph
- [ ] Shell panel sends commands; graph updates in real time
- [ ] Full SPEC.md success criteria checklist passes

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dynamic `import()` of local packages fails in compiled binary | High | Test early in Task 7; use absolute paths resolved at load time |
| React Flow layout thrashes on every SSE update | Med | Debounce re-layout; only re-render changed nodes |
| Effect cascade produces infinite loops in trait code | Med | Cascade depth limit (10) enforced in Task 9 |
| JSON file store grows large with many revisions | Low | Squash (Task 21); not a v0 concern |
| Port conflicts when running multiple `ontos serve` instances | Low | Configurable port; error message is clear |

## Open Questions (from SPEC.md)

1. **SSE vs WebSocket** — SSE confirmed. Simpler for v0.
2. **Bootstrap kernel graph** — `world-root`, `system.log`, `system.registry` nodes created in Task 4.
3. **Desired vs actual state** — effect failure = failure log entry, no revision advance. Task 17.
4. **Derived node recomputation** — manual `recompute` message in v0. Task 15.
