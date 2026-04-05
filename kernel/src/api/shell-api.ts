import { randomUUID } from 'crypto'
import type {
  WorldName,
  BranchName,
  Branch,
  NodeId,
  Message,
  WorldOp,
  WorldRevision,
  RevisionId,
  LogEntry,
  NodeRecord,
  TraitDefinition,
} from '../types.js'
import type { IStore } from '../store/interface.js'
import type { IRuntimeHost } from '../effect/types.js'
import { RevisionStore } from '../world/revision-store.js'
import { TraitRegistry } from '../trait/registry.js'
import { loadPackage } from '../trait/loader.js'
import { dispatchMessage } from '../message/dispatch.js'
import { interpretEffects } from '../effect/interpreter.js'
import { applyOp } from '../node/ops.js'
import { diffRevisions, type RevisionDiff } from '../world/diff.js'

export type SendMessageResult = {
  revision: WorldRevision
  newRevisionId: string
}

export type PreviewMessageResult = {
  /** The revision as it would look after the message, without being persisted */
  previewRevision: WorldRevision
  logMessages: Array<{ level: 'info' | 'warn' | 'error'; message: string }>
}

export type ApplyOpResult = {
  revision: WorldRevision
  newRevisionId: string
}

export class OntosShellApi {
  private readonly revisionStore: RevisionStore

  constructor(
    private readonly store: IStore,
    private readonly registry: TraitRegistry,
    private readonly host: IRuntimeHost,
  ) {
    this.revisionStore = new RevisionStore(store)
  }

  // ─── World / branch ───────────────────────────────────────────────────────

  async createWorld(worldName: WorldName): Promise<WorldRevision> {
    const world = await this.revisionStore.createWorld(worldName)
    return world.baseline
  }

  async getRevision(worldName: WorldName, branch: BranchName): Promise<WorldRevision | null> {
    return this.revisionStore.getCurrentRevision(worldName, branch)
  }

  async getLog(worldName: WorldName, branch: BranchName): Promise<LogEntry[]> {
    return this.revisionStore.getLogEntries(worldName, branch)
  }

  async getRevisionAt(
    worldName: WorldName,
    branch: BranchName,
    revisionId: RevisionId,
  ): Promise<WorldRevision | null> {
    return this.revisionStore.getRevisionAt(worldName, branch, revisionId)
  }

  async diffRevisions(
    worldName: WorldName,
    branch: BranchName,
    revAId: RevisionId,
    revBId: RevisionId,
  ): Promise<RevisionDiff> {
    const revA = await this.revisionStore.getRevisionAt(worldName, branch, revAId)
    if (!revA) throw new Error(`Revision "${revAId}" not found on branch "${branch}"`)
    const revB = await this.revisionStore.getRevisionAt(worldName, branch, revBId)
    if (!revB) throw new Error(`Revision "${revBId}" not found on branch "${branch}"`)
    return diffRevisions(revA, revB)
  }

  async listBranches(worldName: WorldName): Promise<Branch[]> {
    return this.revisionStore.listBranches(worldName)
  }

  async forkBranch(
    worldName: WorldName,
    fromRevisionId: RevisionId,
    newBranchName: BranchName,
  ): Promise<Branch> {
    return this.revisionStore.forkBranch(worldName, fromRevisionId, newBranchName)
  }

  async squashRevisions(
    worldName: WorldName,
    branch: BranchName,
    fromRevId: RevisionId,
    toRevId: RevisionId,
  ): Promise<void> {
    return this.revisionStore.squashRevisions(worldName, branch, fromRevId, toRevId)
  }

  // ─── Node queries ─────────────────────────────────────────────────────────

  async getNode(
    worldName: WorldName,
    branch: BranchName,
    nodeIdOrSlug: string,
  ): Promise<NodeRecord | null> {
    const revision = await this.revisionStore.getCurrentRevision(worldName, branch)
    if (!revision) return null
    return findNode(revision, nodeIdOrSlug)
  }

  async listNodes(worldName: WorldName, branch: BranchName): Promise<NodeRecord[]> {
    const revision = await this.revisionStore.getCurrentRevision(worldName, branch)
    if (!revision) return []
    return Object.values(revision.nodes)
  }

  // ─── Message dispatch ─────────────────────────────────────────────────────

  /**
   * Dispatch a message, interpret effects, persist the new revision, and return it.
   */
  async sendMessage(
    worldName: WorldName,
    branch: BranchName,
    nodeIdOrSlug: string,
    message: Message,
  ): Promise<SendMessageResult> {
    const revision = await this._requireRevision(worldName, branch)
    const node = requireNode(revision, nodeIdOrSlug)

    const { effects } = await dispatchMessage(node.id, message, revision, this.registry)
    const { revision: newRevision, logMessages } = await interpretEffects(
      effects,
      revision,
      this.registry,
      this.host,
    )

    const newRevisionId = randomUUID()
    const appliedOps = effects
      .filter((e): e is Extract<typeof e, { type: 'apply_op' }> => e.type === 'apply_op')
      .map((e) => e.op)

    await this.revisionStore.saveRevision(worldName, branch, {
      revisionId: newRevisionId,
      parentRevisionId: revision.id,
      cause: { type: 'message', targetNodeId: node.id, message },
      effects,
      appliedOps,
    })

    void logMessages // available for callers who want to display them

    return { revision: { ...newRevision, id: newRevisionId }, newRevisionId }
  }

  /**
   * Run dispatch + effect interpretation without saving — returns the would-be revision.
   */
  async previewMessage(
    worldName: WorldName,
    branch: BranchName,
    nodeIdOrSlug: string,
    message: Message,
  ): Promise<PreviewMessageResult> {
    const revision = await this._requireRevision(worldName, branch)
    const node = requireNode(revision, nodeIdOrSlug)

    const { effects } = await dispatchMessage(node.id, message, revision, this.registry)
    const { revision: previewRevision, logMessages } = await interpretEffects(
      effects,
      revision,
      this.registry,
      this.host,
    )

    return { previewRevision, logMessages }
  }

  // ─── Developer op apply ───────────────────────────────────────────────────

  /**
   * Apply a developer operation directly (bypasses trait dispatch), persists.
   */
  async applyOp(
    worldName: WorldName,
    branch: BranchName,
    op: WorldOp,
  ): Promise<ApplyOpResult> {
    const revision = await this._requireRevision(worldName, branch)
    // Normalize express_trait/remove_trait to full URIs so storage is canonical
    if (op.type === 'express_trait' || op.type === 'remove_trait') {
      const resolved = this.registry.resolve(op.trait)
      if (resolved) op = { ...op, trait: resolved.uri }
    }
    const newRevision = applyOp(op, revision)
    const newRevisionId = randomUUID()

    await this.revisionStore.saveRevision(worldName, branch, {
      revisionId: newRevisionId,
      parentRevisionId: revision.id,
      cause: { type: 'operation', operation: op },
      effects: [],
      appliedOps: [op],
    })

    return { revision: { ...newRevision, id: newRevisionId }, newRevisionId }
  }

  // ─── Package loading + trait inspection ──────────────────────────────────

  async loadPackage(modulePath: string): Promise<string[]> {
    const loaded = await loadPackage(modulePath, this.registry)
    return loaded.map((t) => t.uri)
  }

  listTraits(): TraitDefinition[] {
    return this.registry.list()
  }

  getTrait(uri: string): TraitDefinition | null {
    return this.registry.has(uri) ? this.registry.get(uri) : null
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async _requireRevision(
    worldName: WorldName,
    branch: BranchName,
  ): Promise<WorldRevision> {
    const revision = await this.revisionStore.getCurrentRevision(worldName, branch)
    if (!revision) throw new Error(`World "${worldName}" or branch "${branch}" not found`)
    return revision
  }
}

function findNode(revision: WorldRevision, idOrSlug: string): NodeRecord | null {
  return (
    revision.nodes[idOrSlug] ??
    Object.values(revision.nodes).find((n) => n.slug === idOrSlug) ??
    null
  )
}

function requireNode(revision: WorldRevision, idOrSlug: string): NodeRecord {
  const node = findNode(revision, idOrSlug)
  if (!node) throw new Error(`Node "${idOrSlug}" not found`)
  return node
}
