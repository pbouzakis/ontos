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

type SaveRevisionOptions = {
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
    const revisionId: RevisionId = randomUUID()
    const branchName: BranchName = 'main'

    const kernelNodes = makeKernelNodes(name, branchName)
    const nodesMap = Object.fromEntries(kernelNodes.map((n) => [n.id, n]))

    const revision: WorldRevision = {
      id: revisionId,
      worldName: name,
      branchName,
      createdAt: now,
      nodes: nodesMap,
      edges: {},
    }

    const bootstrapLogEntry: LogEntry = {
      id: randomUUID(),
      revisionId,
      timestamp: now,
      cause: { type: 'runtime', description: 'world bootstrap' },
      effects: [],
      appliedOps: [],
    }

    const world: World = {
      name,
      createdAt: now,
      branches: {
        [branchName]: {
          name: branchName,
          worldName: name,
          headRevisionId: revisionId,
          createdAt: now,
        },
      },
      revisions: { [revisionId]: revision },
      log: [bootstrapLogEntry],
    }

    await this.store.saveWorld(world)
    return world
  }

  async getCurrentRevision(
    worldName: WorldName,
    branchName: BranchName,
  ): Promise<WorldRevision | null> {
    const world = await this.store.loadWorld(worldName)
    if (!world) return null
    const branch = world.branches[branchName]
    if (!branch) return null
    return world.revisions[branch.headRevisionId] ?? null
  }

  async saveRevision(
    worldName: WorldName,
    branchName: BranchName,
    revision: WorldRevision,
    opts: SaveRevisionOptions,
  ): Promise<void> {
    const world = await this.store.loadWorld(worldName)
    if (!world) throw new Error(`World "${worldName}" not found`)
    const branch = world.branches[branchName]
    if (!branch) throw new Error(`Branch "${branchName}" not found in world "${worldName}"`)

    const logEntry: LogEntry = {
      id: randomUUID(),
      revisionId: revision.id,
      parentRevisionId: revision.parentRevisionId,
      timestamp: new Date().toISOString(),
      cause: opts.cause,
      effects: opts.effects,
      appliedOps: opts.appliedOps,
    }

    const updated: World = {
      ...world,
      branches: {
        ...world.branches,
        [branchName]: { ...branch, headRevisionId: revision.id },
      },
      revisions: { ...world.revisions, [revision.id]: revision },
      log: [...world.log, logEntry],
    }

    await this.store.saveWorld(updated)
  }
}
