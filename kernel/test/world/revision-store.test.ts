import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { JsonFileStore } from '../../src/store/json-file-store'
import { RevisionStore } from '../../src/world/revision-store'
import type { LogEntryCause } from '../../src/types'

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

    it('stores a baseline revision with kernel nodes', async () => {
      const world = await store.createWorld('my-world')
      const { baseline } = world
      expect(baseline).toBeDefined()
      expect(Object.values(baseline.nodes).some((n) => n.slug === 'world-root')).toBe(true)
      expect(Object.values(baseline.nodes).some((n) => n.slug === 'system.log')).toBe(true)
      expect(Object.values(baseline.nodes).some((n) => n.slug === 'system.registry')).toBe(true)
    })

    it('does NOT store a separate revisions map', async () => {
      const world = await store.createWorld('my-world')
      expect((world as unknown as Record<string, unknown>)['revisions']).toBeUndefined()
    })

    it('persists the world so it survives a reload', async () => {
      await store.createWorld('persistent-world')
      const store2 = new RevisionStore(new JsonFileStore(dir))
      const loaded = await store2.getWorld('persistent-world')
      expect(loaded?.name).toBe('persistent-world')
    })

    it('throws if world already exists', async () => {
      await store.createWorld('dup')
      await expect(store.createWorld('dup')).rejects.toThrow()
    })
  })

  describe('getCurrentRevision', () => {
    it('returns the baseline state when no ops have been applied', async () => {
      await store.createWorld('w1')
      const rev = await store.getCurrentRevision('w1', 'main')
      expect(rev).not.toBeNull()
      expect(rev?.worldName).toBe('w1')
      expect(rev?.branchName).toBe('main')
      // Bootstrap kernel nodes are present
      expect(Object.values(rev!.nodes).some((n) => n.slug === 'world-root')).toBe(true)
    })

    it('returns null for a world that does not exist', async () => {
      const rev = await store.getCurrentRevision('no-such-world', 'main')
      expect(rev).toBeNull()
    })

    it('replays ops to reconstruct current state after saveRevision', async () => {
      await store.createWorld('w2')
      const nodeId = randomUUID()
      const revId = randomUUID()
      const cause: LogEntryCause = { type: 'runtime', description: 'test' }

      await store.saveRevision('w2', 'main', {
        revisionId: revId,
        cause,
        effects: [],
        appliedOps: [{
          type: 'create_node',
          node: {
            id: nodeId,
            slug: 'new-node',
            kinds: [],
            url: '/worlds/w2/nodes/new-node',
            state: {},
            traits: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }],
      })

      const head = await store.getCurrentRevision('w2', 'main')
      expect(head?.id).toBe(revId)
      expect(head?.nodes[nodeId]).toBeDefined()
      expect(head?.nodes[nodeId].slug).toBe('new-node')
    })

    it('stacks multiple ops correctly', async () => {
      await store.createWorld('w3')
      const nodeId = randomUUID()
      const now = new Date().toISOString()
      const cause: LogEntryCause = { type: 'runtime', description: 'test' }

      // First op: create node
      await store.saveRevision('w3', 'main', {
        revisionId: randomUUID(),
        cause,
        effects: [],
        appliedOps: [{
          type: 'create_node',
          node: { id: nodeId, slug: 'book', kinds: ['Book'], url: '/worlds/w3/nodes/book', state: {}, traits: [], createdAt: now, updatedAt: now },
        }],
      })

      // Second op: set state
      const finalRevId = randomUUID()
      await store.saveRevision('w3', 'main', {
        revisionId: finalRevId,
        cause,
        effects: [],
        appliedOps: [{
          type: 'set_node_state',
          nodeId,
          patch: { 'reading.lifecycle': { status: 'active' } },
        }],
      })

      const head = await store.getCurrentRevision('w3', 'main')
      expect(head?.id).toBe(finalRevId)
      expect(head?.nodes[nodeId].state['reading.lifecycle']).toEqual({ status: 'active' })
    })
  })

  describe('saveRevision', () => {
    it('advances the branch head after saving', async () => {
      await store.createWorld('w4')
      const revId = randomUUID()
      await store.saveRevision('w4', 'main', {
        revisionId: revId,
        cause: { type: 'runtime', description: 'test' },
        effects: [],
        appliedOps: [],
      })
      const world = await store.getWorld('w4')
      expect(world?.branches['main'].headRevisionId).toBe(revId)
    })

    it('appends a log entry for every saved revision', async () => {
      await store.createWorld('w5')
      const revId = randomUUID()
      await store.saveRevision('w5', 'main', {
        revisionId: revId,
        cause: { type: 'runtime', description: 'second entry' },
        effects: [],
        appliedOps: [],
      })
      const entries = await store.getLogEntries('w5', 'main')
      expect(entries.some((e) => e.revisionId === revId)).toBe(true)
    })
  })
})
