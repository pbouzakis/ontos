import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JsonFileStore } from '../../src/store/json-file-store'
import { RevisionStore } from '../../src/world/revision-store'
import type { WorldOp, LogEntryCause } from '../../src/types'

describe('RevisionStore', () => {
  let dir: string
  let store: RevisionStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ontos-revstore-'))
    store = new RevisionStore(new JsonFileStore(dir))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('createWorld', () => {
    it('creates a world with a main branch', async () => {
      const world = await store.createWorld('my-world')
      expect(world.name).toBe('my-world')
      expect(world.branches['main']).toBeDefined()
    })

    it('creates a bootstrap revision with kernel nodes', async () => {
      const world = await store.createWorld('my-world')
      const headId = world.branches['main'].headRevisionId
      const revision = world.revisions[headId]
      expect(revision).toBeDefined()
      expect(Object.values(revision.nodes).some((n) => n.slug === 'world-root')).toBe(true)
      expect(Object.values(revision.nodes).some((n) => n.slug === 'system.log')).toBe(true)
      expect(Object.values(revision.nodes).some((n) => n.slug === 'system.registry')).toBe(true)
    })

    it('persists the world so it survives a reload', async () => {
      await store.createWorld('persistent-world')
      const store2 = new RevisionStore(new JsonFileStore(dir))
      const loaded = await store2.getWorld('persistent-world')
      expect(loaded).not.toBeNull()
      expect(loaded?.name).toBe('persistent-world')
    })

    it('throws if world already exists', async () => {
      await store.createWorld('dup')
      await expect(store.createWorld('dup')).rejects.toThrow()
    })
  })

  describe('getCurrentRevision', () => {
    it('returns the head revision for main branch', async () => {
      await store.createWorld('w1')
      const rev = await store.getCurrentRevision('w1', 'main')
      expect(rev).not.toBeNull()
      expect(rev?.worldName).toBe('w1')
      expect(rev?.branchName).toBe('main')
    })

    it('returns null for a world that does not exist', async () => {
      const rev = await store.getCurrentRevision('no-such-world', 'main')
      expect(rev).toBeNull()
    })
  })

  describe('saveRevision', () => {
    it('advances the branch head after saving', async () => {
      await store.createWorld('w2')
      const rev = await store.getCurrentRevision('w2', 'main')
      if (!rev) throw new Error('no revision')

      const cause: LogEntryCause = { type: 'runtime', description: 'test' }
      const ops: WorldOp[] = [{ type: 'create_node', node: { id: 'n1', slug: 'new-node', kinds: [], url: '/worlds/w2/nodes/new-node', state: {}, traits: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }]
      const newRev = {
        ...rev,
        id: 'rev-2',
        parentRevisionId: rev.id,
        nodes: { ...rev.nodes, 'n1': { id: 'n1', slug: 'new-node', kinds: [], url: '/worlds/w2/nodes/new-node', state: {}, traits: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      }

      await store.saveRevision('w2', 'main', newRev, { cause, effects: [], appliedOps: ops })

      const head = await store.getCurrentRevision('w2', 'main')
      expect(head?.id).toBe('rev-2')
    })

    it('appends a log entry for every saved revision', async () => {
      await store.createWorld('w3')
      const rev = await store.getCurrentRevision('w3', 'main')
      if (!rev) throw new Error('no revision')

      const cause: LogEntryCause = { type: 'runtime', description: 'test entry' }
      const newRev = { ...rev, id: 'rev-2', parentRevisionId: rev.id }
      await store.saveRevision('w3', 'main', newRev, { cause, effects: [], appliedOps: [] })

      const world = await store.getWorld('w3')
      expect(world?.log.some((e) => e.revisionId === 'rev-2')).toBe(true)
    })
  })
})
