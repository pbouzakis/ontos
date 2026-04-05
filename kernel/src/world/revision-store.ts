import { randomUUID } from 'crypto'
import type {
  World,
  WorldName,
  BranchName,
  Branch,
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

  /**
   * Replay the branch log up to (and including) the given revisionId.
   * Returns null if the revisionId is not found on this branch.
   */
  async getRevisionAt(
    worldName: WorldName,
    branchName: BranchName,
    revisionId: RevisionId,
  ): Promise<WorldRevision | null> {
    const world = await this.store.loadWorld(worldName)
    if (!world) return null

    if (world.baseline.id === revisionId) return world.baseline

    const branchEntries = world.log.filter((e) => e.branchName === branchName)
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
      if (entry.revisionId === revisionId) return current
    }

    return null
  }

  async listBranches(worldName: WorldName): Promise<Branch[]> {
    const world = await this.store.loadWorld(worldName)
    if (!world) return []
    return Object.values(world.branches)
  }

  /**
   * Fork a new branch from any revision on any existing branch.
   * The new branch gets a single "fork baseline" log entry that materializes
   * all ops from the source branch up to the fork point, so replay works
   * without needing cross-branch awareness.
   */
  async forkBranch(
    worldName: WorldName,
    fromRevisionId: RevisionId,
    newBranchName: BranchName,
  ): Promise<Branch> {
    const world = await this.store.loadWorld(worldName)
    if (!world) throw new Error(`World "${worldName}" not found`)
    if (world.branches[newBranchName]) {
      throw new Error(`Branch "${newBranchName}" already exists in world "${worldName}"`)
    }

    // Collect all ops from whichever branch contains fromRevisionId
    let sourceBranchName: BranchName | null = null
    let accumulatedOps: WorldOp[] = []

    if (world.baseline.id === fromRevisionId) {
      // Fork from genesis — no ops needed
      sourceBranchName = world.baseline.branchName
    } else {
      outer: for (const branchName of Object.keys(world.branches)) {
        const entries = world.log.filter((e) => e.branchName === branchName)
        const ops: WorldOp[] = []
        for (const entry of entries) {
          ops.push(...entry.appliedOps)
          if (entry.revisionId === fromRevisionId) {
            sourceBranchName = branchName
            accumulatedOps = ops
            break outer
          }
        }
      }
    }

    if (sourceBranchName === null) {
      throw new Error(`Revision "${fromRevisionId}" not found in any branch of world "${worldName}"`)
    }

    const now = new Date().toISOString()
    const newBranch: Branch = {
      name: newBranchName,
      worldName,
      headRevisionId: fromRevisionId,
      createdAt: now,
      forkedFromRevisionId: fromRevisionId,
    }

    // Materialize all accumulated ops into a single fork-baseline log entry
    const forkEntry: LogEntry = createLogEntry({
      revisionId: fromRevisionId,
      branchName: newBranchName,
      cause: {
        type: 'runtime',
        description: `fork from ${sourceBranchName}@${fromRevisionId.slice(0, 8)}`,
      },
      effects: [],
      appliedOps: accumulatedOps,
    })

    const updated: World = {
      ...world,
      branches: { ...world.branches, [newBranchName]: newBranch },
      log: [...world.log, forkEntry],
    }

    await this.store.saveWorld(updated)
    return newBranch
  }

  /**
   * Squash all log entries on the branch between (and including) fromRevId and toRevId
   * into a single squash-marker entry. Entries before fromRevId and after toRevId are preserved.
   * The combined ops of the squashed range are collapsed into the marker so replay still works.
   */
  async squashRevisions(
    worldName: WorldName,
    branchName: BranchName,
    fromRevId: RevisionId,
    toRevId: RevisionId,
  ): Promise<void> {
    const world = await this.store.loadWorld(worldName)
    if (!world) throw new Error(`World "${worldName}" not found`)

    const branchEntries = world.log.filter((e) => e.branchName === branchName)
    const otherEntries = world.log.filter((e) => e.branchName !== branchName)

    let inRange = false
    let squashedOps: WorldOp[] = []
    let squashedCount = 0
    let foundTo = false
    const before: LogEntry[] = []
    const after: LogEntry[] = []

    for (const entry of branchEntries) {
      if (!inRange && entry.revisionId !== fromRevId) {
        before.push(entry)
        continue
      }
      if (!inRange) inRange = true

      squashedOps.push(...entry.appliedOps)
      squashedCount++

      if (entry.revisionId === toRevId) {
        foundTo = true
        inRange = false
        continue
      }
    }

    // Entries we encounter after inRange turns off
    let pastTo = false
    for (const entry of branchEntries) {
      if (!pastTo) {
        if (entry.revisionId === toRevId) pastTo = true
        continue
      }
      after.push(entry)
    }

    if (!foundTo) throw new Error(`Revision "${toRevId}" not found after "${fromRevId}" on branch "${branchName}"`)

    const squashMarker: LogEntry = createLogEntry({
      revisionId: toRevId,
      branchName,
      cause: {
        type: 'runtime',
        description: `squash ${squashedCount} revision(s) (${fromRevId.slice(0, 8)}..${toRevId.slice(0, 8)})`,
      },
      effects: [],
      appliedOps: squashedOps,
    })

    const updated: World = {
      ...world,
      log: [...otherEntries, ...before, squashMarker, ...after],
    }

    await this.store.saveWorld(updated)
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
