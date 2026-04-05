import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { JsonFileStore } from '../../src/store/json-file-store'
import { RevisionStore } from '../../src/world/revision-store'
import type { LogEntryCause } from '../../src/types'

describe('RevisionStore.forkBranch', () => {
  let dir: string
  let store: RevisionStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ontos-fork-'))
    store = new RevisionStore(new JsonFileStore(dir))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates a new branch at the given revision', async () => {
    await store.createWorld('w')
    const nodeId = randomUUID()
    const rev1 = randomUUID()
    const now = new Date().toISOString()
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }

    await store.saveRevision('w', 'main', {
      revisionId: rev1,
      cause,
      effects: [],
      appliedOps: [{
        type: 'create_node',
        node: { id: nodeId, slug: 'alpha', kinds: [], url: '/nodes/alpha', state: {}, traits: [], createdAt: now, updatedAt: now },
      }],
    })

    const branch = await store.forkBranch('w', rev1, 'feature')
    expect(branch.name).toBe('feature')
    expect(branch.headRevisionId).toBe(rev1)
    expect(branch.forkedFromRevisionId).toBe(rev1)
  })

  it('forked branch replays to the fork point state', async () => {
    await store.createWorld('w')
    const nodeId = randomUUID()
    const rev1 = randomUUID()
    const now = new Date().toISOString()
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }

    await store.saveRevision('w', 'main', {
      revisionId: rev1,
      cause,
      effects: [],
      appliedOps: [{
        type: 'create_node',
        node: { id: nodeId, slug: 'alpha', kinds: [], url: '/nodes/alpha', state: {}, traits: [], createdAt: now, updatedAt: now },
      }],
    })

    await store.forkBranch('w', rev1, 'feature')

    const featureRev = await store.getCurrentRevision('w', 'feature')
    expect(featureRev).not.toBeNull()
    expect(featureRev!.nodes[nodeId]?.slug).toBe('alpha')
  })

  it('new commits on forked branch do not affect main', async () => {
    await store.createWorld('w')
    const nodeId = randomUUID()
    const rev1 = randomUUID()
    const rev2 = randomUUID()
    const now = new Date().toISOString()
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }

    await store.saveRevision('w', 'main', {
      revisionId: rev1,
      cause,
      effects: [],
      appliedOps: [{
        type: 'create_node',
        node: { id: nodeId, slug: 'shared', kinds: [], url: '/nodes/shared', state: {}, traits: [], createdAt: now, updatedAt: now },
      }],
    })

    await store.forkBranch('w', rev1, 'feature')

    const featureNodeId = randomUUID()
    await store.saveRevision('w', 'feature', {
      revisionId: rev2,
      cause,
      effects: [],
      appliedOps: [{
        type: 'create_node',
        node: { id: featureNodeId, slug: 'feature-only', kinds: [], url: '/nodes/feature-only', state: {}, traits: [], createdAt: now, updatedAt: now },
      }],
    })

    const mainRev = await store.getCurrentRevision('w', 'main')
    const featureRev = await store.getCurrentRevision('w', 'feature')

    expect(mainRev!.nodes[featureNodeId]).toBeUndefined()
    expect(featureRev!.nodes[featureNodeId]?.slug).toBe('feature-only')
    expect(featureRev!.nodes[nodeId]?.slug).toBe('shared')
  })

  it('throws if branch already exists', async () => {
    await store.createWorld('w')
    const world = await store.getWorld('w')
    const baselineId = world!.baseline.id
    await store.forkBranch('w', baselineId, 'feature')
    await expect(store.forkBranch('w', baselineId, 'feature')).rejects.toThrow(/already exists/)
  })

  it('throws if revisionId not found', async () => {
    await store.createWorld('w')
    await expect(store.forkBranch('w', 'nonexistent-rev', 'feature')).rejects.toThrow(/not found/)
  })

  it('listBranches returns all branches', async () => {
    await store.createWorld('w')
    const world = await store.getWorld('w')
    const baselineId = world!.baseline.id
    await store.forkBranch('w', baselineId, 'feature')
    const branches = await store.listBranches('w')
    expect(branches.map((b) => b.name).sort()).toEqual(['feature', 'main'])
  })
})
