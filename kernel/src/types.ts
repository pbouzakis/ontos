// ─── ID aliases ────────────────────────────────────────────────────────────

export type NodeId = string
export type EdgeId = string
export type RevisionId = string
export type BranchName = string
export type TraitUri = string
export type Kind = string
export type WorldName = string

// ─── Node ──────────────────────────────────────────────────────────────────

export type NodeRecord = {
  id: NodeId
  slug: string
  name?: string
  kinds: Kind[]
  url: string
  /** State namespaced by trait URI or domain key, e.g. state["reading.lifecycle"].status */
  state: Record<string, Record<string, unknown>>
  traits: TraitUri[]
  createdAt: string
  updatedAt: string
  archived?: boolean
}

// ─── Edge ──────────────────────────────────────────────────────────────────

export type EdgeRecord = {
  id: EdgeId
  type: string
  from: NodeId
  to: NodeId
  state?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── Revision ──────────────────────────────────────────────────────────────

export type WorldRevision = {
  id: RevisionId
  worldName: WorldName
  branchName: BranchName
  parentRevisionId?: RevisionId
  createdAt: string
  createdBy?: string
  nodes: Record<NodeId, NodeRecord>
  edges: Record<EdgeId, EdgeRecord>
  metadata?: Record<string, unknown>
}

// ─── Branch ────────────────────────────────────────────────────────────────

export type Branch = {
  name: BranchName
  worldName: WorldName
  headRevisionId: RevisionId
  createdAt: string
  forkedFromRevisionId?: RevisionId
}

// ─── Message ───────────────────────────────────────────────────────────────

export type Message = {
  type: string
  payload?: Record<string, unknown>
  meta?: {
    causedBy?: string
    at?: string
  }
}

// ─── Effects ───────────────────────────────────────────────────────────────

export type Effect =
  | { type: 'apply_op'; op: WorldOp }
  | { type: 'emit_message'; targetNodeId: NodeId; message: Message }
  | { type: 'open_listener'; protocol: 'http' | 'tcp'; port: number; nodeId: NodeId }
  | { type: 'close_listener'; listenerId: string }
  | { type: 'schedule_message'; at: string; targetNodeId: NodeId; message: Message }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

// ─── Operations ────────────────────────────────────────────────────────────

export type WorldOp =
  | { type: 'create_node'; node: Omit<NodeRecord, 'url'> & { url?: string } }
  | { type: 'set_node_state'; nodeId: NodeId; patch: Record<string, Record<string, unknown>> }
  | { type: 'archive_node'; nodeId: NodeId }
  | { type: 'create_edge'; edge: EdgeRecord }
  | { type: 'remove_edge'; edgeId: EdgeId }
  | { type: 'express_trait'; nodeId: NodeId; trait: TraitUri }
  | { type: 'remove_trait'; nodeId: NodeId; trait: TraitUri }

// ─── Log entry ─────────────────────────────────────────────────────────────

export type LogEntryCause =
  | { type: 'message'; targetNodeId: NodeId; message: Message }
  | { type: 'operation'; operation: WorldOp }
  | { type: 'runtime'; description: string }

export type LogEntry = {
  id: string
  revisionId: RevisionId
  parentRevisionId?: RevisionId
  branchName: BranchName
  timestamp: string
  cause: LogEntryCause
  effects: Effect[]
  /** Ops to replay when reconstructing state from the baseline. Must be complete and ordered. */
  appliedOps: WorldOp[]
}

// ─── Trait system ──────────────────────────────────────────────────────────

export type StateFieldSpec = {
  type: string
  required?: boolean
  default?: unknown
}

export type TraitContext = {
  node: NodeRecord
  revision: WorldRevision
  now: string
}

export type HandlerResult = {
  effects?: Effect[]
}

export type MessageHandler = (ctx: TraitContext, msg: Message) => HandlerResult | Promise<HandlerResult>

export type TraitDefinition = {
  uri: TraitUri
  description?: string
  ownsState?: Record<string, StateFieldSpec>
  defaultState?: Record<string, unknown>
  handles: Record<string, MessageHandler>
  requiresTraits?: TraitUri[]
}

// ─── World ─────────────────────────────────────────────────────────────────

export type World = {
  name: WorldName
  createdAt: string
  branches: Record<BranchName, Branch>
  /** Genesis snapshot (or last squash baseline). Current state is derived by replaying log ops on top. */
  baseline: WorldRevision
  /** All log entries across branches, in insertion order. Each entry carries the ops needed for replay. */
  log: LogEntry[]
}
