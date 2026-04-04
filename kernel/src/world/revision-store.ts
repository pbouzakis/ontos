import { randomUUID } from 'crypto'
import type {
  World,
  WorldName,
  BranchName,
  WorldRevision,
  RevisionId,
  Effect,
  WorldOp,
  LogEntryCause,
  LogEntry,
} from '../types'
import type { IStore } from '../store/interface'
import { makeKernelNodes } from './bootstrap'
import { createLogEntry } from '../log/log-entry'
import { applyOp } from '../node/ops'

type SaveRevisionOptions = {
  revisionId: RevisionId
  parentRevisionId?: RevisionId
  cause: LogEntryCause
  effects: Effect[]
  appliedOps: WorldOp[]
}

export class RevisionStore {
  constructor(private readonly store: IStore) {}

  async getWorld(name: WorldName): Promise<World | null> {
    return this.store.loadWorld(name)
  }

  async createWorld(name: WorldName): Promise<World> {
    const existing = await this.store.loadWorld(name)
    if (existing) throw new Error(`World "${name}" already exists`)

    const now = new Date().toISOString()
    const baselineId: RevisionId = randomUUID()
    const branchName: BranchName = 'main'

    const kernelNodes = makeKernelNodes(name, branchName)
    const nodesMap = Object.fromEntries(kernelNodes.map((n) => [n.id, n]))

    const baseline: WorldRevision = {
      id: baselineId,
      worldName: name,
      branchName,
      createdAt: now,
      nodes: nodesMap,
      edges: {},
    }

    const bootstrapEntry: LogEntry = createLogEntry({
      revisionId: baselineId,
      branchName,
      cause: { type: 'runtime', description: 'world bootstrap' },
      effects: [],
      appliedOps: [],
    })

    const world: World = {
      name,
      createdAt: now,
      branches: {
        [branchName]: {
          name: branchName,
          worldName: name,
          headRevisionId: baselineId,
          createdAt: now,
        },
      },
      baseline,
      log: [bootstrapEntry],
    }

    await this.store.saveWorld(world)
    return world
  }

  /**
   * Reconstruct the current world state by replaying log ops on top of the baseline.
   * O(log entries for branch) — fast for typical world sizes in v0.
   */
  async getCurrentRevision(
    worldName: WorldName,
    branchName: BranchName,
  ): Promise<WorldRevision | null> {
    const world = await this.store.loadWorld(worldName)
    if (!world) return null
    const branch = world.branches[branchName]
    if (!branch) return null

    return replayBranch(world, branchName)
  }

  /**
   * Append a log entry for a change. Does NOT store a full snapshot —
   * the new state is always derived by replaying from the baseline.
   */
  async saveRevision(
    worldName: WorldName,
    branchName: BranchName,
    opts: SaveRevisionOptions,
  ): Promise<void> {
    const world = await this.store.loadWorld(worldName)
    if (!world) throw new Error(`World "${worldName}" not found`)
    const branch = world.branches[branchName]
    if (!branch) throw new Error(`Branch "${branchName}" not found in world "${worldName}"`)

    const logEntry = createLogEntry({
      revisionId: opts.revisionId,
      parentRevisionId: opts.parentRevisionId ?? branch.headRevisionId,
      branchName,
      cause: opts.cause,
      effects: opts.effects,
      appliedOps: opts.appliedOps,
    })

    const updated: World = {
      ...world,
      branches: {
        ...world.branches,
        [branchName]: { ...branch, headRevisionId: opts.revisionId },
      },
      log: [...world.log, logEntry],
    }

    await this.store.saveWorld(updated)
  }

  async getLogEntries(worldName: WorldName, branchName: BranchName): Promise<LogEntry[]> {
    const world = await this.store.loadWorld(worldName)
    if (!world) return []
    return world.log.filter((e) => e.branchName === branchName)
  }
}

/**
 * Replay all branch log entries on top of the baseline to produce the current WorldRevision.
 */
export function replayBranch(world: World, branchName: BranchName): WorldRevision {
  const branchEntries = world.log.filter((e) => e.branchName === branchName)
  if (branchEntries.length === 0) return world.baseline

  let current: WorldRevision = { ...world.baseline }

  for (const entry of branchEntries) {
    for (const op of entry.appliedOps) {
      current = applyOp(op, current)
    }
    current = {
      ...current,
      id: entry.revisionId,
      parentRevisionId: entry.parentRevisionId,
      branchName,
    }
  }

  return current
}
