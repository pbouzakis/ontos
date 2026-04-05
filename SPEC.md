# Spec: Ontos v0

## Objective

Ontos is a live, persistent graph runtime of computational beings. Nodes are interacted with through domain messages. Traits evaluate those messages purely and return effects. The runtime interprets effects, applies privileged operations, and produces new immutable world revisions.

**v0 goal:** Prove the model with a small, coherent runtime. A developer can use the shell/REPL to create nodes, attach traits, send messages, and run scripts — while the web UI shows the live world graph updating in real time.

**Who uses it:** Developers exploring the Ontos model, building both domain objects (books, reading lists) and computational objects (servers, timers) in a persistent, inspectable, branchable world.

**Success looks like:** A developer runs `ontos repl`, creates a `Book` node, attaches `reading.lifecycle`, sends `mark_active`, sees the new revision in history, forks a branch, and opens the browser to see the graph with the book node highlighted.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Node.js LTS |
| Monorepo | pnpm workspaces |
| Tests | Vitest |
| Lint / Format | ESLint + Prettier |
| Persistence | JSON files (v0) behind a swappable storage interface |
| CLI | Node.js bin entry, installable via npm, invoked as `ontos` |
| Web server | Express (or Fastify) — serves HTTP API + static web UI |
| Web UI | React + Vite |
| Graph canvas | React Flow |

**Persistence path:** JSON files → SQLite → Postgres. The storage interface hides this. v0 uses JSON only.

---

## Commands

```bash
# Monorepo root
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages
pnpm test                 # Run all tests across workspaces
pnpm lint                 # Lint all packages

# Per-workspace
pnpm --filter kernel test
pnpm --filter kernel build
pnpm --filter app dev     # Start dev server with hot reload (runtime + UI)
pnpm --filter app build   # Build CLI binary + web UI bundle

# CLI (after global install or via npx)
ontos serve               # Start runtime, HTTP API, and web UI server
ontos shell               # Attach a shell to an already-running runtime
ontos repl                # Start an embedded runtime and drop into the shell
ontos run <script.ts>     # Execute a script file against the runtime
```

---

## Project Structure

```
/ontos
  pnpm-workspace.yaml
  package.json                  Root scripts + shared dev deps (TypeScript, ESLint, Prettier, Vitest)
  SPEC.md

  /kernel                       Pure runtime — no UI, no CLI, no HTTP
    /src
      /world                    World, branch, revision management
      /node                     Node + edge model and operations
      /trait                    Trait registry, loader, composition rules
      /message                  Message dispatch and handler resolution
      /effect                   Effect interpreter
      /store                    Storage interface + JSON file adapter
      /log                      Operation log and log entry model
      /api                      Shell API surface (kernel exposes this, app consumes it)
    /test
    package.json

  /app                          CLI, shell, HTTP server, and web UI
    /src
      /cli                      ontos binary entry point and command routing
      /shell                    REPL + shell command implementations
      /server                   Express HTTP API server
      /ui                       React + Vite web frontend
        /components
          /graph                React Flow graph canvas (nodes + edges)
          /inspector            Node detail panel (state, traits, history)
          /shell                Embedded shell / command panel
          /revision             Revision timeline view
    /test
    package.json
    vite.config.ts

  /packages                     Domain behavior packages loaded by the runtime
    /reading
      /book                     reading.lifecycle trait
      /list                     reading.list trait
      /query                    latestActiveBook derived node trait
    /net
      /server                   server.lifecycle trait
    package.json

  /scripts                      Bootstrap and utility scripts
    bootstrap-reading-world.ts
```

---

## Code Style

TypeScript strict mode throughout. Types are primary documentation — avoid comments that just restate the type.

```typescript
// Effects are discriminated unions — always exhaustive-switch them
function interpretEffect(effect: Effect, world: WorldRevision): InterpretResult {
  switch (effect.type) {
    case "apply_op":      return applyOp(effect.op, world)
    case "emit_message":  return scheduleMessage(effect)
    case "open_listener": return openListener(effect)
    case "log":           return writeLog(effect)
    default:
      effect satisfies never
      throw new Error(`Unhandled effect type: ${(effect as Effect).type}`)
  }
}

// Trait handlers are pure functions — no mutation, no I/O
const markActive: MessageHandler = (ctx, _msg) => ({
  effects: [{
    type: "apply_op",
    op: {
      type: "set_node_state",
      nodeId: ctx.node.id,
      patch: { "reading.lifecycle": { status: "active", startedAt: ctx.now } }
    }
  }]
})
```

**Conventions:**
- No classes for domain logic — plain objects + functions
- Named exports only, no default exports
- File names: `kebab-case.ts`
- Types/interfaces: `PascalCase`
- Functions/values: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Errors: typed `Error` subclasses, never raw strings
- Storage access only through the storage interface — never raw `fs` calls inside kernel logic

---

## Testing Strategy

**Framework:** Vitest

**Test locations:** `<package>/test/` mirrors `<package>/src/` structure.

**Test levels:**

| Level | What | Where |
|---|---|---|
| Unit | Pure functions: trait handlers, effect interpreter, revision diff | `kernel/test/` |
| Integration | Full pipeline: message → dispatch → effects → new revision | `kernel/test/integration/` |
| CLI | Shell command execution via the shell API surface | `app/test/` |

**Coverage targets:**
- Kernel core: 80%+
- Trait handlers: 100% (pure functions — no excuse)
- Shell commands: integration-level coverage, not line-coverage targets

**Example:**
```typescript
it("mark_active produces a set_node_state effect", () => {
  const ctx = makeTraitContext({ node: bookNode, revision: emptyRevision, now: "2026-04-04T10:00:00Z" })
  const result = bookLifecycleTrait.handles.mark_active(ctx, { type: "mark_active" })
  expect(result.effects).toContainEqual({
    type: "apply_op",
    op: {
      type: "set_node_state",
      nodeId: bookNode.id,
      patch: { "reading.lifecycle": { status: "active", startedAt: "2026-04-04T10:00:00Z" } }
    }
  })
})
```

---

## Boundaries

**Always:**
- Run `pnpm test` before committing kernel changes
- Handle all effect types exhaustively (discriminated union + `satisfies never`)
- Trait handlers must remain pure — no mutation, no I/O, no side effects
- Every node must have a `slug` and a derived `url`
- Storage access goes through the storage interface only

**Ask first:**
- Changing core data model types (`NodeRecord`, `WorldRevision`, `Effect`, `WorldOp`)
- Adding a new persistence adapter
- Changing shell command surface (names, argument shapes, flags)
- Adding a new npm dependency to kernel
- Changing HTTP API routes or payload shapes
- Changing the React Flow graph schema (how nodes/edges map to visual elements)

**Never:**
- Bypass the storage interface with direct `fs` calls inside kernel
- Have trait handlers perform I/O or mutate world state
- Commit secrets, env files, or world data files
- Delete or skip failing tests — fix them
- Add visual/HTTP concerns to the kernel package

---

## Success Criteria

### Phase 1 — Runtime Core
- [ ] Create a world and persist it as JSON; reload correctly on process restart
- [ ] Create nodes and edges; read them back from the store
- [ ] Each change produces a new immutable revision; branch head advances
- [ ] Log entries recorded for every operation

### Phase 2 — Trait + Message System
- [ ] Load a local package from the filesystem via dynamic `import()`
- [ ] Express a trait on a node; inspect active traits
- [ ] Send a message → dispatch to trait handler → receive effects → produce new revision
- [ ] `message preview` shows the diff without committing
- [ ] Conflicting trait handlers (two traits handle same message) are rejected at expression time

### Phase 3 — Reading Example
- [ ] `ontos repl` can create a Book, attach `reading.lifecycle`, send `mark_active`
- [ ] State is namespaced: `node.state["reading.lifecycle"].status === "active"`
- [ ] Revision history shows the change with full log entry

### Phase 4 — Computational Node
- [ ] Server node with `server.lifecycle` trait
- [ ] `start_server` produces an `open_listener` effect
- [ ] Runtime opens a real TCP listener; if binding fails, records a failure log entry (no revision advance)
- [ ] `runtime listeners` shell command shows the active listener

### Phase 5 — History Tools
- [ ] `world diff <revA> <revB>` shows node/edge/state changes between revisions
- [ ] `branch fork <from> <name>` creates a new branch from any revision
- [ ] `revision squash <range>` compacts a range into a new baseline snapshot

### Phase 6 — HTTP API + Web UI
- [ ] `ontos serve` starts runtime + HTTP API + serves web UI on a single port
- [ ] Browser shows a live React Flow graph of current world nodes and edges
- [ ] Clicking a node opens the inspector: state, expressed traits, revision history
- [ ] Can send a message to a node from the UI; graph updates live
- [ ] Embedded shell panel in the UI for issuing commands without leaving the browser

---

## Open Questions

1. **Revision storage format:** Full snapshot per revision (v0) vs. baseline + incremental deltas (future). Address when storage size becomes a concern.
2. **Effect cascade bounding:** Recursive message cascades run synchronously to a fixed max depth (default: 10) and throw on overflow. Configurable later.
3. **Desired vs. actual state for computational nodes:** Effects are atomic with the revision. If an effect fails at the host layer (e.g., port in use), the runtime records a failure log entry instead of advancing the branch head. No reconciliation loop in v0.
4. **Derived node recomputation:** Manual or message-triggered in v0. No reactive dependency engine.
5. **Bootstrap kernel graph:** Define the minimal set of system nodes created on `world create` (e.g., `world-root`, `system.registry`, `system.log`).
6. **Web UI live updates:** Does the UI poll the HTTP API, or does the server push updates via WebSocket/SSE? Recommendation: SSE for simplicity in v0.
