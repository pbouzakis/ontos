import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { OntosShellApi } from '../../src/api/shell-api.js'
import { JsonFileStore } from '../../src/store/json-file-store.js'
import { TraitRegistry } from '../../src/trait/registry.js'
import type { IRuntimeHost } from '../../src/effect/types.js'
import type { TraitDefinition } from '../../src/types.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const lifecycleTrait: TraitDefinition = {
  uri: 'pkg://reading/book@v1#reading.lifecycle',
  handles: {
    mark_active: (_ctx, _msg) => ({
      effects: [
        {
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: _ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'active' } },
          },
        },
      ],
    }),
    mark_finished: (_ctx, _msg) => ({
      effects: [
        {
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: _ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'finished' } },
          },
        },
      ],
    }),
  },
}

function makeStubHost(): IRuntimeHost {
  return {
    openListener: vi.fn().mockResolvedValue({ listenerId: 'l1' }),
    closeListener: vi.fn().mockResolvedValue(undefined),
    scheduleMessage: vi.fn().mockResolvedValue(undefined),
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('OntosShellApi (integration)', () => {
  let tmpDir: string
  let api: OntosShellApi
  let registry: TraitRegistry

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ontos-shellapi-'))
    registry = new TraitRegistry()
    registry.register(lifecycleTrait)
    api = new OntosShellApi(new JsonFileStore(tmpDir), registry, makeStubHost())
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─── World / revision ────────────────────────────────────────────────────

  it('createWorld returns the baseline revision', async () => {
    const revision = await api.createWorld('my-world')
    expect(revision.worldName).toBe('my-world')
    expect(revision.branchName).toBe('main')
    // kernel bootstrap nodes
    const slugs = Object.values(revision.nodes).map((n) => n.slug)
    expect(slugs).toContain('world-root')
  })

  it('getRevision returns the current revision', async () => {
    await api.createWorld('my-world')
    const revision = await api.getRevision('my-world', 'main')
    expect(revision).not.toBeNull()
    expect(revision!.worldName).toBe('my-world')
  })

  it('getRevision returns null for unknown world', async () => {
    const result = await api.getRevision('nope', 'main')
    expect(result).toBeNull()
  })

  // ─── Node queries ────────────────────────────────────────────────────────

  it('listNodes returns kernel nodes after world creation', async () => {
    await api.createWorld('my-world')
    const nodes = await api.listNodes('my-world', 'main')
    expect(nodes.length).toBeGreaterThanOrEqual(3)
  })

  it('getNode finds by slug', async () => {
    await api.createWorld('my-world')
    const node = await api.getNode('my-world', 'main', 'world-root')
    expect(node).not.toBeNull()
    expect(node!.slug).toBe('world-root')
  })

  it('getNode finds by id', async () => {
    await api.createWorld('my-world')
    const nodes = await api.listNodes('my-world', 'main')
    const first = nodes[0]
    const found = await api.getNode('my-world', 'main', first.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(first.id)
  })

  it('getNode returns null for unknown id/slug', async () => {
    await api.createWorld('my-world')
    const found = await api.getNode('my-world', 'main', 'nonexistent')
    expect(found).toBeNull()
  })

  // ─── applyOp ─────────────────────────────────────────────────────────────

  it('applyOp creates a node and advances revision', async () => {
    await api.createWorld('my-world')
    const { revision, newRevisionId } = await api.applyOp('my-world', 'main', {
      type: 'create_node',
      node: {
        id: 'node-book-1',
        slug: 'paradise-lost',
        name: 'Paradise Lost',
        kinds: ['Book'],
        url: '/worlds/my-world/nodes/paradise-lost',
        state: {},
        traits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    expect(revision.nodes['node-book-1']).toBeDefined()
    expect(revision.nodes['node-book-1'].slug).toBe('paradise-lost')
    expect(newRevisionId).toBeTruthy()
  })

  // ─── sendMessage ─────────────────────────────────────────────────────────

  it('sendMessage → new revision saved → log entry recorded', async () => {
    await api.createWorld('my-world')

    // Create book node
    await api.applyOp('my-world', 'main', {
      type: 'create_node',
      node: {
        id: 'book-1',
        slug: 'paradise-lost',
        name: 'Paradise Lost',
        kinds: ['Book'],
        url: '/worlds/my-world/nodes/paradise-lost',
        state: {},
        traits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    // Express lifecycle trait on it
    await api.applyOp('my-world', 'main', {
      type: 'express_trait',
      nodeId: 'book-1',
      trait: lifecycleTrait.uri,
    })

    // Send message
    const { revision } = await api.sendMessage('my-world', 'main', 'paradise-lost', {
      type: 'mark_active',
    })

    expect(revision.nodes['book-1'].state['reading.lifecycle']?.status).toBe('active')

    const log = await api.getLog('my-world', 'main')
    const messageEntry = log.find(
      (e) => e.cause.type === 'message' && e.cause.message.type === 'mark_active',
    )
    expect(messageEntry).toBeDefined()
  })

  // ─── previewMessage ───────────────────────────────────────────────────────

  it('previewMessage returns diff without persisting', async () => {
    await api.createWorld('my-world')

    await api.applyOp('my-world', 'main', {
      type: 'create_node',
      node: {
        id: 'book-2',
        slug: 'moby-dick',
        name: 'Moby-Dick',
        kinds: ['Book'],
        url: '/worlds/my-world/nodes/moby-dick',
        state: {},
        traits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    await api.applyOp('my-world', 'main', {
      type: 'express_trait',
      nodeId: 'book-2',
      trait: lifecycleTrait.uri,
    })

    const logBefore = await api.getLog('my-world', 'main')

    const { previewRevision } = await api.previewMessage('my-world', 'main', 'moby-dick', {
      type: 'mark_finished',
    })

    expect(previewRevision.nodes['book-2'].state['reading.lifecycle']?.status).toBe('finished')

    // log should NOT have grown — preview does not persist
    const logAfter = await api.getLog('my-world', 'main')
    expect(logAfter).toHaveLength(logBefore.length)
  })

  // ─── getLog ───────────────────────────────────────────────────────────────

  it('getLog returns entries in insertion order', async () => {
    await api.createWorld('my-world')
    await api.applyOp('my-world', 'main', {
      type: 'create_node',
      node: {
        id: 'n1',
        slug: 'node-one',
        kinds: [],
        url: '/worlds/my-world/nodes/node-one',
        state: {},
        traits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    await api.applyOp('my-world', 'main', {
      type: 'create_node',
      node: {
        id: 'n2',
        slug: 'node-two',
        kinds: [],
        url: '/worlds/my-world/nodes/node-two',
        state: {},
        traits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    const log = await api.getLog('my-world', 'main')
    expect(log.length).toBeGreaterThanOrEqual(3) // bootstrap + 2 ops
    expect(log[0].cause.type).toBe('runtime') // bootstrap entry first
  })
})
