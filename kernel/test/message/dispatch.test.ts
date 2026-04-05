import { describe, it, expect, beforeEach } from 'vitest'
import { dispatchMessage, NoHandlerError, HandlerConflictError } from '../../src/message/dispatch.js'
import { TraitRegistry } from '../../src/trait/registry.js'
import type { WorldRevision, NodeRecord, TraitDefinition } from '../../src/types.js'
import { randomUUID } from 'crypto'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRevision(nodes: NodeRecord[]): WorldRevision {
  const nodeMap: WorldRevision['nodes'] = {}
  for (const n of nodes) nodeMap[n.id] = n
  return {
    id: randomUUID(),
    worldName: 'test-world',
    branchName: 'main',
    createdAt: new Date().toISOString(),
    nodes: nodeMap,
    edges: {},
  }
}

function makeNode(overrides: Partial<NodeRecord> = {}): NodeRecord {
  return {
    id: randomUUID(),
    slug: 'test-node',
    kinds: ['Thing'],
    url: '/worlds/test/nodes/test-node',
    state: {},
    traits: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

const lifecycleTrait: TraitDefinition = {
  uri: 'pkg://reading/book@v1#reading.lifecycle',
  handles: {
    mark_active: (_ctx, _msg) => ({
      effects: [{ type: 'log', level: 'info', message: 'marked active' }],
    }),
    mark_finished: (_ctx, _msg) => ({ effects: [] }),
  },
}

const otherTrait: TraitDefinition = {
  uri: 'pkg://other/thing@v1#other.trait',
  handles: {
    do_other: () => ({ effects: [] }),
  },
}

// Conflict trait — also handles mark_active
const conflictTrait: TraitDefinition = {
  uri: 'pkg://conflict/thing@v1#conflict.trait',
  handles: {
    mark_active: () => ({ effects: [] }),
  },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('dispatchMessage', () => {
  let registry: TraitRegistry

  beforeEach(() => {
    registry = new TraitRegistry()
    registry.register(lifecycleTrait)
    registry.register(otherTrait)
  })

  it('dispatches to the correct handler and returns effects', async () => {
    const node = makeNode({ traits: [lifecycleTrait.uri] })
    const revision = makeRevision([node])

    const result = await dispatchMessage(node.id, { type: 'mark_active' }, revision, registry)

    expect(result.effects).toHaveLength(1)
    expect(result.effects[0]).toMatchObject({ type: 'log', message: 'marked active' })
  })

  it('passes correct TraitContext to handler', async () => {
    let capturedCtx: Parameters<typeof lifecycleTrait.handles.mark_active>[0] | null = null
    const inspectTrait: TraitDefinition = {
      uri: 'pkg://inspect@v1#inspect',
      handles: {
        inspect: (ctx, _msg) => {
          capturedCtx = ctx
          return { effects: [] }
        },
      },
    }
    registry.register(inspectTrait)

    const node = makeNode({ traits: [inspectTrait.uri] })
    const revision = makeRevision([node])

    await dispatchMessage(node.id, { type: 'inspect' }, revision, registry)

    expect(capturedCtx).not.toBeNull()
    expect(capturedCtx!.node).toBe(node)
    expect(capturedCtx!.revision).toBe(revision)
    expect(typeof capturedCtx!.now).toBe('string')
  })

  it('returns empty effects when handler returns no effects', async () => {
    const node = makeNode({ traits: [lifecycleTrait.uri] })
    const revision = makeRevision([node])

    const result = await dispatchMessage(node.id, { type: 'mark_finished' }, revision, registry)
    expect(result.effects).toEqual([])
  })

  it('throws NoHandlerError when no trait handles the message type', async () => {
    const node = makeNode({ traits: [lifecycleTrait.uri] })
    const revision = makeRevision([node])

    await expect(
      dispatchMessage(node.id, { type: 'unknown_message' }, revision, registry),
    ).rejects.toThrow(NoHandlerError)
  })

  it('throws NoHandlerError when node has no traits', async () => {
    const node = makeNode({ traits: [] })
    const revision = makeRevision([node])

    await expect(
      dispatchMessage(node.id, { type: 'mark_active' }, revision, registry),
    ).rejects.toThrow(NoHandlerError)
  })

  it('throws HandlerConflictError when two traits handle the same message type', async () => {
    registry.register(conflictTrait)
    const node = makeNode({ traits: [lifecycleTrait.uri, conflictTrait.uri] })
    const revision = makeRevision([node])

    await expect(
      dispatchMessage(node.id, { type: 'mark_active' }, revision, registry),
    ).rejects.toThrow(HandlerConflictError)
  })

  it('throws when node does not exist in revision', async () => {
    const revision = makeRevision([])
    await expect(
      dispatchMessage('nonexistent-id', { type: 'mark_active' }, revision, registry),
    ).rejects.toThrow(/not found/)
  })

  it('dispatches correctly when node has multiple non-conflicting traits', async () => {
    const node = makeNode({ traits: [lifecycleTrait.uri, otherTrait.uri] })
    const revision = makeRevision([node])

    // mark_active is handled by lifecycleTrait only
    const result = await dispatchMessage(node.id, { type: 'mark_active' }, revision, registry)
    expect(result.effects).toHaveLength(1)

    // do_other is handled by otherTrait only
    const result2 = await dispatchMessage(node.id, { type: 'do_other' }, revision, registry)
    expect(result2.effects).toEqual([])
  })
})
