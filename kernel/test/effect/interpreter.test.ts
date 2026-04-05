import { describe, it, expect, vi, beforeEach } from 'vitest'
import { interpretEffects, CascadeDepthError } from '../../src/effect/interpreter.js'
import { TraitRegistry } from '../../src/trait/registry.js'
import type { IRuntimeHost } from '../../src/effect/types.js'
import type { WorldRevision, NodeRecord, Effect, TraitDefinition } from '../../src/types.js'
import { randomUUID } from 'crypto'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRevision(nodes: NodeRecord[] = []): WorldRevision {
  const nodeMap: WorldRevision['nodes'] = {}
  for (const n of nodes) nodeMap[n.id] = n
  return {
    id: randomUUID(),
    worldName: 'test',
    branchName: 'main',
    createdAt: new Date().toISOString(),
    nodes: nodeMap,
    edges: {},
  }
}

function makeNode(id = randomUUID(), traits: string[] = []): NodeRecord {
  return {
    id,
    slug: 'test-node',
    kinds: ['Thing'],
    url: '/worlds/test/nodes/test-node',
    state: {},
    traits,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeStubHost(overrides: Partial<IRuntimeHost> = {}): IRuntimeHost {
  return {
    openListener: vi.fn().mockResolvedValue({ listenerId: 'listener-1' }),
    closeListener: vi.fn().mockResolvedValue(undefined),
    scheduleMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('interpretEffects', () => {
  let registry: TraitRegistry
  let host: IRuntimeHost

  beforeEach(() => {
    registry = new TraitRegistry()
    host = makeStubHost()
  })

  it('applies apply_op effects to the revision', async () => {
    const nodeId = randomUUID()
    const node = makeNode(nodeId)
    const revision = makeRevision([node])

    const effects: Effect[] = [
      {
        type: 'apply_op',
        op: {
          type: 'set_node_state',
          nodeId,
          patch: { 'reading.lifecycle': { status: 'active' } },
        },
      },
    ]

    const result = await interpretEffects(effects, revision, registry, host)

    expect(result.revision.nodes[nodeId].state['reading.lifecycle']?.status).toBe('active')
  })

  it('collects log effects', async () => {
    const revision = makeRevision()
    const effects: Effect[] = [
      { type: 'log', level: 'info', message: 'hello' },
      { type: 'log', level: 'warn', message: 'careful' },
    ]

    const result = await interpretEffects(effects, revision, registry, host)

    expect(result.logMessages).toHaveLength(2)
    expect(result.logMessages[0]).toEqual({ level: 'info', message: 'hello' })
    expect(result.logMessages[1]).toEqual({ level: 'warn', message: 'careful' })
  })

  it('delegates open_listener to host', async () => {
    const nodeId = randomUUID()
    const revision = makeRevision()
    const effects: Effect[] = [
      { type: 'open_listener', protocol: 'http', port: 3000, nodeId },
    ]

    await interpretEffects(effects, revision, registry, host)

    expect(host.openListener).toHaveBeenCalledWith({ protocol: 'http', port: 3000, nodeId })
  })

  it('delegates close_listener to host', async () => {
    const revision = makeRevision()
    const effects: Effect[] = [{ type: 'close_listener', listenerId: 'listener-1' }]

    await interpretEffects(effects, revision, registry, host)

    expect(host.closeListener).toHaveBeenCalledWith('listener-1')
  })

  it('delegates schedule_message to host', async () => {
    const revision = makeRevision()
    const effects: Effect[] = [
      {
        type: 'schedule_message',
        at: '2030-01-01T00:00:00Z',
        targetNodeId: 'some-node',
        message: { type: 'tick' },
      },
    ]

    await interpretEffects(effects, revision, registry, host)

    expect(host.scheduleMessage).toHaveBeenCalledWith({
      at: '2030-01-01T00:00:00Z',
      targetNodeId: 'some-node',
      message: { type: 'tick' },
    })
  })

  it('processes emit_message as a follow-up dispatch (BFS)', async () => {
    const nodeId = randomUUID()
    const stateLog: string[] = []

    const trait: TraitDefinition = {
      uri: 'pkg://test/cascade@v1#cascade',
      handles: {
        first: (_ctx, _msg) => {
          stateLog.push('first')
          return {
            effects: [{ type: 'emit_message', targetNodeId: nodeId, message: { type: 'second' } }],
          }
        },
        second: (_ctx, _msg) => {
          stateLog.push('second')
          return { effects: [] }
        },
      },
    }
    registry.register(trait)

    const node = makeNode(nodeId, [trait.uri])
    const revision = makeRevision([node])

    const effects: Effect[] = [
      { type: 'emit_message', targetNodeId: nodeId, message: { type: 'first' } },
    ]

    await interpretEffects(effects, revision, registry, host)

    expect(stateLog).toEqual(['first', 'second'])
  })

  it('throws CascadeDepthError when cascade exceeds 10', async () => {
    const nodeId = randomUUID()

    // Trait that always emits another message to itself (infinite loop)
    const trait: TraitDefinition = {
      uri: 'pkg://test/loop@v1#loop',
      handles: {
        ping: (_ctx, _msg) => ({
          effects: [{ type: 'emit_message', targetNodeId: nodeId, message: { type: 'ping' } }],
        }),
      },
    }
    registry.register(trait)

    const node = makeNode(nodeId, [trait.uri])
    const revision = makeRevision([node])

    const effects: Effect[] = [
      { type: 'emit_message', targetNodeId: nodeId, message: { type: 'ping' } },
    ]

    await expect(interpretEffects(effects, revision, registry, host)).rejects.toThrow(
      CascadeDepthError,
    )
  })

  it('returns unchanged revision when no effects are given', async () => {
    const revision = makeRevision()
    const result = await interpretEffects([], revision, registry, host)
    expect(result.revision).toBe(revision)
  })
})
