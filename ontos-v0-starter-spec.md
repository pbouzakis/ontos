# Ontos v0 Starter Spec

## Working Description

Ontos is a live, persistent graph runtime composed of concrete computational beings. Each revision of the world is immutable. Nodes are interacted with through domain messages. Traits evaluate those messages purely and return effects. The Ontos runtime interprets those effects, applies privileged operations, performs side effects, and produces new world revisions. Because history is first-class, worlds can be replayed, rewound, forked, and squashed.

---

## Vision

Ontos is not a static program description, workflow graph, or class model that gets instantiated into a separate runtime. The graph is the running system itself.

Ontos should let users model problems in the terms they naturally think in: books, reading lists, servers, routes, timers, workflows, people, and relations. Concrete objects come first. Reusable abstractions emerge from use rather than being mandatory upfront.

The system should combine:
- object-first runtime beings
- dynamic trait-based behavior
- immutable world revisions
- runtime-interpreted effects
- first-class history, replay, and branching
- interactive live exploration through a shell/REPL
- eventual visual graph composition for authoring and inspection

---

## Non-Goals for v0

Ontos v0 is not:
- a full visual editor first
- a class hierarchy or ORM
- a distributed runtime
- a CRDT collaboration engine
- a full reactive engine
- a general-purpose compiler
- a full permission/security model
- a plugin-defined open effect system
- a complete prototype/archetype system

The first goal is to prove the model with a small but coherent runtime.

---

## Core Tenets

### 1. The system is live, but revisions are immutable
Ontos is live in the sense that the world continuously evolves, but each individual revision is immutable.

### 2. The graph is the runtime
The graph is not a build artifact. It is the running world.

### 3. Objects are primary
Concrete nodes are the primary runtime beings. Abstractions come later.

### 4. Behavior is pure
Traits do not directly mutate the world or perform side effects.

### 5. The runtime owns effects
Only the Ontos runtime interprets effects and performs side effects.

### 6. Messages are domain intent
Messages are the normal object-facing interaction model.

### 7. Operations are privileged edits
Operations are more powerful than messages and are reserved for runtime, tooling, and developer control.

### 8. History is first-class
Every accepted change has lineage and can be replayed, rewound, forked, diffed, and squashed.

### 9. Kinds are semantic, not authoritative
Kinds help humans understand, group, and query nodes. They do not define behavior.

### 10. Traits are the unit of behavior
Behavior is composed through explicit trait expression, not inheritance.

### 11. Relations are first-class
Edges are part of the ontology, not incidental plumbing.

### 12. Code is external
Behavior packages live in files and are loaded by the runtime.

### 13. Every node is addressable
Every node should have a stable URL/path for navigation, APIs, and tooling.

### 14. The system must be interactively explorable
Ontos must always provide a shell/REPL or equivalent live interface to inspect and manipulate the world.

---

## Core Terminology

## World
A named persistent universe with lineage, branches, and revisions.

## Revision
An immutable snapshot of the world graph at a point in time.

## Branch
A named pointer to a head revision.

## Node
A concrete runtime being with identity, state, relations, traits, and addressability.

## Edge
A first-class typed relation between nodes.

## Kind
A lightweight semantic label for grouping, UI, and query.

## Trait
A composable unit of behavior expressed on a node.

## Package
A versioned external container for behavior definitions.

Example:
`pkg://reading/book@v1#reading.lifecycle`

## Message
A domain-shaped signal sent to a node.

Examples:
- `mark_active`
- `mark_finished`
- `add_book`
- `start_server`

## Effect
A requested consequence returned by pure behavior evaluation.

Examples:
- apply an operation
- emit a message
- open a listener
- schedule work
- write a log entry

## Operation
A privileged world-editing instruction interpreted by the runtime.

Examples:
- `create_node`
- `set_node_state`
- `create_edge`
- `express_trait`

## Prototype
A possible future reusable archetype extracted from concrete objects. Not required in v0.

## Capability
An affordance a node has because of its expressed traits.

---

## Architecture Overview

Ontos has three major layers:

### 1. Messages
Domain-shaped intent sent to nodes.

### 2. Effects
Pure behavior returns effects describing desired consequences.

### 3. Runtime + Operations
The runtime interprets effects, performs side effects, applies privileged world operations, and produces a new immutable revision.

The basic pipeline is:

1. Start from current revision
2. Send a message or apply a developer operation
3. Evaluate trait behavior against the current revision
4. Produce effects
5. Runtime interprets effects
6. Runtime applies resulting operations and side effects
7. Produce a new revision
8. Append a log entry
9. Move branch head to the new revision

---

## Runtime Layers

### Authored Code Layer
External file-based behavior:
- packages
- trait definitions
- message handlers
- helper libraries
- runtime adapters

### Runtime World Layer
Persistent state:
- nodes
- edges
- revisions
- branches
- operation log
- runtime metadata
- derived nodes

### Runtime Host Layer
Live services:
- effect interpreter
- scheduler
- process/listener registry
- shell API
- package loader
- revision store

---

## Core Ontology

Ontos v0 has a deliberately small core ontology:

1. World
2. Revision
3. Node
4. Edge
5. Trait reference
6. Message
7. Effect
8. Operation
9. Log entry
10. Branch

Everything else is layered on top.

---

## Data Model Sketch

```ts
type NodeId = string
type EdgeId = string
type RevisionId = string
type BranchName = string
type TraitUri = string
type Kind = string
```

### Node

```ts
type NodeRecord = {
  id: NodeId
  slug: string
  name?: string
  kinds: Kind[]
  url: string
  state: Record<string, Record<string, unknown>>
  traits: TraitUri[]
  createdAt: string
  updatedAt: string
  archived?: boolean
}
```

Notes:
- `state` is namespaced by trait or state domain
- `url` may be derived from world + branch + slug, but should be treated as a first-class navigable address

### Edge

```ts
type EdgeRecord = {
  id: EdgeId
  type: string
  from: NodeId
  to: NodeId
  state?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

### Revision

```ts
type WorldRevision = {
  id: RevisionId
  worldName: string
  branchName: BranchName
  parentRevisionId?: RevisionId
  createdAt: string
  createdBy?: string
  nodes: Record<NodeId, NodeRecord>
  edges: Record<EdgeId, EdgeRecord>
  metadata?: Record<string, unknown>
}
```

### Message

```ts
type Message = {
  type: string
  payload?: Record<string, unknown>
  meta?: {
    causedBy?: string
    at?: string
  }
}
```

### Effect

```ts
type Effect =
  | { type: "apply_op"; op: WorldOp }
  | { type: "emit_message"; targetNodeId: NodeId; message: Message }
  | { type: "open_listener"; protocol: "http"; port: number }
  | { type: "close_listener"; listenerId: string }
  | { type: "schedule_message"; at: string; targetNodeId: NodeId; message: Message }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
```

### Developer Operation

```ts
type DeveloperOperation =
  | { type: "create_node"; node: Partial<NodeRecord> }
  | { type: "set_node_state"; nodeId: NodeId; patch: Record<string, Record<string, unknown>> }
  | { type: "create_edge"; edge: EdgeRecord }
  | { type: "remove_edge"; edgeId: EdgeId }
  | { type: "express_trait"; nodeId: NodeId; trait: TraitUri }
  | { type: "remove_trait"; nodeId: NodeId; trait: TraitUri }
```

### Runtime Operation
For v0, runtime operations can be identical to developer operations, though the source/cause should be tracked separately.

```ts
type WorldOp = DeveloperOperation
```

### Log Entry

```ts
type LogEntry = {
  id: string
  revisionId: RevisionId
  parentRevisionId?: RevisionId
  timestamp: string
  cause:
    | { type: "message"; targetNodeId: NodeId; message: Message }
    | { type: "operation"; operation: DeveloperOperation }
    | { type: "runtime"; description: string }
  effects: Effect[]
  appliedOps: WorldOp[]
}
```

---

## Package and Trait Model

Behavior is authored in versioned external packages, loaded by the runtime from files.

Example trait URI:

`pkg://reading/book@v1#reading.lifecycle`

### Package Principles
- package URIs are explicit and stable
- packages live outside the world
- the world stores explicit trait URIs, not embedded source blobs as the primary truth
- packages are loaded on runtime start in v0

### Trait Definition Shape

```ts
type StateFieldSpec = {
  type: string
  required?: boolean
  default?: unknown
}

type TraitDefinition = {
  uri: TraitUri
  description?: string
  ownsState?: Record<string, StateFieldSpec>
  defaultState?: Record<string, unknown>
  handles: Record<string, MessageHandler>
  requiresTraits?: TraitUri[]
}
```

### Handler Shape

```ts
type TraitContext = {
  node: NodeRecord
  revision: WorldRevision
  now: string
}

type HandlerResult = {
  effects?: Effect[]
}

type MessageHandler = (
  ctx: TraitContext,
  msg: Message
) => HandlerResult | Promise<HandlerResult>
```

Important rule:
- trait handlers do not directly mutate world state
- trait handlers do not directly perform external side effects
- trait handlers only return effects

---

## State Ownership Rules

State should not be one giant flat map.

Preferred v0 rule:
- each trait owns a namespaced state slice
- traits should only modify state they own
- runtime/tooling may bypass this with privileged developer operations

Example:

```ts
state: {
  "reading.lifecycle": {
    status: "active",
    startedAt: "2026-04-04T10:00:00Z"
  }
}
```

This avoids state collisions and makes composition more explicit.

---

## Composition Rules

For v0:

1. A node may express multiple traits
2. Traits may coexist if they do not conflict
3. If two traits handle the same message, runtime should reject unless explicit precedence is defined
4. Trait-owned state should be namespaced
5. Trait dependencies should be declared explicitly
6. Trait behavior remains pure and effect-returning

Future versions may support more advanced composition/precedence rules.

---

## Messages vs Effects vs Operations

This distinction is central.

### Messages
Domain-facing intent.
Used by normal object interaction.

Examples:
- `mark_active`
- `mark_finished`
- `add_book`
- `start_server`

### Effects
Pure requested consequences returned by traits.

Examples:
- apply an op
- emit another message
- open a network listener
- schedule future work
- log something

### Operations
Privileged world-editing instructions.
More powerful than messages.

Examples:
- directly patch node state
- create/remove edges
- attach/remove traits

Rule:
- objects do not get raw direct operation access during ordinary message handling
- developers, tooling, and runtime internals may apply operations directly

---

## Immutability, Replay, Forking, and Squashing

Ontos revisions are immutable.

### Implications
- every accepted change produces a new revision
- the current world is the head revision of a branch
- history can be replayed
- revisions can be diffed
- branches can be forked from any revision
- logs can be squashed into baselines for performance

### Replay
Rebuild a revision from a baseline snapshot plus subsequent log entries.

### Fork
Create a new branch starting at an existing revision.

### Squash
Compact a sequence of historical revisions into a new baseline snapshot while preserving lineage metadata as needed.

### Why this matters
- debugging
- experimentation
- user-specific worlds
- collaboration later
- previews and branches
- safe live editing
- reproducibility

---

## Node Addressability

Every node should be directly navigable.

A node should have:
- stable internal ID
- slug
- URL/path

Example forms:
- `ontos://world/main/node/paradise-lost`
- `/worlds/main/nodes/paradise-lost`

Recommendation for v0:
- store `slug`
- derive `url`
- expose `url` everywhere in APIs and shell output

---

## Kernel / Bootstrap World

A new world should not be a totally empty void.

Ontos v0 should likely bootstrap a minimal kernel graph including:

- `world-root`
- `system.registry`
- `system.package-registry`
- `system.log`
- `system.runtime`
- optional `system.scheduler`

The kernel should be small and infrastructure-focused.
User-domain objects should still be created explicitly.

---

## Node Categories

Ontos should support both:

### Domain Nodes
Examples:
- Book
- ReadingList
- Person
- Order

### Computational Nodes
Examples:
- Server
- Route
- Timer
- Scheduler
- Workflow
- Projection
- Query
- Queue consumer

This is important because Ontos is not just a knowledge graph or state graph. It is a graph of computational beings.

---

## Derived Values

Derived values should be represented as real nodes, not just ephemeral query results.

Example:
- `Current Most Recent Active Book`

For v0:
- derived values may be recomputed manually
- or recomputed from specific message handlers
- a full reactive dependency engine is not required yet

Principle:
- maintained facts can themselves be nodes

---

## Interactive Surfaces

Ontos should expose at least three primary interactive surfaces:

1. Shell / REPL
2. HTTP/API interface
3. Visual world editor

For v0, the shell should come first.

### Principle
If a concept exists in Ontos, it should be explorable interactively.

That includes:
- nodes
- edges
- traits
- messages
- effects
- revisions
- branches
- runtime processes

---

## Shell / REPL

The Ontos shell is a live client into the running runtime.

The runtime host runs the world engine, revision engine, and effect interpreter.
The shell connects to that runtime for inspection, messaging, scripting, and control.

### Modes

#### Attached Shell
Connect to an already-running runtime.

```bash
ontos serve
ontos shell
```

#### Embedded REPL
Start a local runtime and immediately drop into a shell.

```bash
ontos repl
```

#### Script Runner
Execute a script against the runtime.

```bash
ontos run scripts/bootstrap-reading-world.ts
```

### Shell Responsibilities
The shell should support three levels of interaction:

#### 1. Domain Interaction
- create and inspect objects
- send messages
- query derived objects

#### 2. Developer / Runtime Control
- apply privileged operations
- inspect revisions
- fork branches
- squash history
- patch state directly

#### 3. Runtime / Process Control
- inspect listeners
- inspect running computational objects
- inspect pending scheduled messages
- inspect effect logs

### Core Shell Commands

#### World
- `world show`
- `world use <branch>`
- `world history`
- `world diff <revA> <revB>`

#### Branch
- `branch list`
- `branch fork <from> <name>`
- `branch switch <name>`

#### Revision
- `revision show <id>`
- `revision checkout <id>`
- `revision squash <range>`

#### Node
- `node list`
- `node show <id|url|slug>`
- `node create`
- `node patch`
- `node traits <id>`

#### Edge
- `edge list`
- `edge create`
- `edge remove`

#### Message
- `message send`
- `message preview`

#### Operation
- `op apply`
- `op preview`

#### Runtime
- `runtime effects`
- `runtime listeners`
- `runtime processes`

#### Package
- `pkg list`
- `pkg load`
- `trait inspect <uri>`

### Preview vs Commit
The shell should support:
- previewing the effects and diff of a message/op
- committing it to create a new revision

Example:

```bash
message preview /nodes/paradise-lost mark_finished
message commit /nodes/paradise-lost mark_finished
```

### JS/TS Scripting Mode
The shell should ideally also expose a JS/TS evaluation context bound to Ontos APIs.

Example:

```ts
const book = await ontos.node.create({
  kind: "Book",
  name: "Paradise Lost"
})

await ontos.message.send(book.url, "mark_active")
await ontos.node.show(book.url)
```

Important rule:
- the shell should be a client of the same runtime APIs as everything else
- it should not bypass the model

---

## HTTP/API Interface

Ontos should expose APIs for:
- node lookup by ID or URL
- message sending
- developer operation application
- revision lookup
- branch control
- package inspection
- runtime inspection

This can be minimal in v0.

---

## Visual World Editor

The visual editor is important, but should follow the runtime and shell, not precede them.

In the future it should support:
- world browsing
- node inspection
- graph editing
- message sending
- program composition via graph stitching
- computational node inspection

Not required to prove v0.

---

## v0 Required Capabilities

### Runtime Core
- create/load a world
- persist revisions
- maintain current branch head
- append log entries
- replay from baseline + log

### Node and Edge Lifecycle
- create nodes
- patch node state
- create edges
- remove edges
- inspect relations

### Trait System
- load packages from local filesystem
- register trait exports
- express/remove traits on nodes
- inspect active traits

### Messaging
- send messages to nodes
- resolve handlers from expressed traits
- return effects
- interpret effects

### Operations
- allow developer/tooling direct operations
- keep message access more constrained than developer ops

### History
- revision lookup
- revision diff
- fork branch
- squash log/baseline

### Addressability
- every node has a stable URL/path

### Shell
- attached shell
- embedded REPL
- script runner
- preview vs commit

### Runtime Inspection
- effect log
- operation log
- basic runtime registry for listeners/processes

---

## Reading Domain Walkthrough

### Create a Book
Create a node:
- name: `Paradise Lost`
- kind: `Book`

Attach trait:
- `pkg://reading/book@v1#reading.lifecycle`

Trait owns state:
- `status`
- `startedAt`
- `finishedAt`

Messages:
- `mark_want_to_read`
- `mark_active`
- `mark_finished`
- `mark_inactive`

### Create a Reading List
Create a node:
- name: `Paul's Reading List`
- kind: `ReadingList`

Attach trait:
- `pkg://reading/list@v1#reading.list`

Messages:
- `add_book`
- `remove_book`

Create edge:
- `Paul's Reading List --contains--> Paradise Lost`

### Derived Node
Create:
- `Current Most Recent Active Book`
- kind: `DerivedValue`
- trait: `pkg://reading/query@v1#latestActiveBook`

This node may be recomputed manually or from specific triggers in v0.

---

## Computational Node Walkthrough: Server

Create a node:
- name: `api-server`
- kind: `Server`

Attach trait:
- `pkg://net/server@v1#server.lifecycle`

Messages:
- `start_server`
- `stop_server`

Possible effects from `start_server`:
- apply operation marking desired state as running
- request `open_listener` on port 3000
- append log entry

The runtime interprets the listener effect, opens the listener, and creates a new revision reflecting the resulting accepted state.

This demonstrates that Ontos can host not only domain objects but computational objects that do work.

---

## Suggested File / Package Layout for v0

```text
/ontos
  /packages
    /reading
      /book
        trait.ts
      /list
        trait.ts
      /query
        trait.ts
    /net
      /server
        trait.ts
  /runtime
    world.ts
    revision-store.ts
    op-log.ts
    effect-interpreter.ts
    package-loader.ts
    message-dispatch.ts
    shell.ts
  /api
    http.ts
  /scripts
    bootstrap-reading-world.ts
```

---

## Suggested v0 Implementation Plan

### Phase 1: Minimal runtime core
- revision store
- node/edge model
- log entries
- branch head tracking
- package loading
- shell with simple ops

### Phase 2: Trait and message system
- trait registry
- message dispatch
- effect return model
- operation interpretation
- preview vs commit

### Phase 3: Reading example
- reading lifecycle trait
- reading list trait
- derived node example
- shell walkthrough

### Phase 4: Computational node example
- server lifecycle trait
- basic listener effect
- runtime registry for active listeners
- shell inspection commands

### Phase 5: History tools
- diff
- fork
- squash
- replay from baseline

### Phase 6: Minimal HTTP/API
- node lookup
- message send
- revision inspect

---

## Open Questions

1. Should revisions store full snapshots, or baseline + incremental deltas, or both?
2. What exact effect set is built into the runtime in v0?
3. How should recursive effect/message cascades be scheduled and bounded?
4. How should desired state vs actual runtime state be represented for computational nodes like servers?
5. Should edges remain purely relational in v0, or allow richer metadata constraints?
6. What is the exact bootstrap kernel graph?
7. How should derived nodes declare dependencies in future versions?
8. When prototypes are added later, how should they relate to traits and concrete objects?
9. Should trait permissions/capabilities be declared explicitly in v0.5?
10. What should the first visual editor surface be: inspector-first or graph-edit-first?

---

## Guiding Principle

Ontos should let users work with living computational beings in a persistent world, while preserving purity, history, and inspectability.
