import { describe, it, expect } from 'vitest'
import { applyOp } from '../../src/node/ops'
import type { WorldRevision, NodeRecord, EdgeRecord } from '../../src/types'

function makeRevision(overrides?: Partial<WorldRevision>): WorldRevision {
  return {
    id: 'rev-1',
    worldName: 'test-world',
    branchName: 'main',
    createdAt: '2026-01-01T00:00:00.000Z',
    nodes: {},
    edges: {},
    ...overrides,
  }
}

function makeNode(overrides?: Partial<NodeRecord>): NodeRecord {
  return {
    id: 'node-1',
    slug: 'test-node',
    kinds: [],
    url: '/worlds/test-world/nodes/test-node',
    state: {},
    traits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEdge(overrides?: Partial<EdgeRecord>): EdgeRecord {
  return {
    id: 'edge-1',
    type: 'contains',
    from: 'node-1',
    to: 'node-2',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('applyOp', () => {
  it('does not mutate the input revision', () => {
    const rev = makeRevision()
    const node = makeNode()
    const next = applyOp({ type: 'create_node', node }, rev)
    expect(rev.nodes).toEqual({})
    expect(next.nodes['node-1']).toBeDefined()
  })

  describe('create_node', () => {
    it('adds the node to the revision', () => {
      const rev = makeRevision()
      const node = makeNode()
      const next = applyOp({ type: 'create_node', node }, rev)
      expect(next.nodes['node-1']).toEqual(node)
    })

    it('derives the url from world + slug when not provided', () => {
      const rev = makeRevision()
      const node = makeNode({ url: undefined })
      const next = applyOp({ type: 'create_node', node }, rev)
      expect(next.nodes['node-1'].url).toBe('/worlds/test-world/nodes/test-node')
    })

    it('throws if a node with the same id already exists', () => {
      const node = makeNode()
      const rev = makeRevision({ nodes: { 'node-1': node } })
      expect(() => applyOp({ type: 'create_node', node }, rev)).toThrow()
    })
  })

  describe('set_node_state', () => {
    it('deep-merges state patch into the node', () => {
      const node = makeNode({ state: { 'reading.lifecycle': { status: 'want_to_read' } } })
      const rev = makeRevision({ nodes: { 'node-1': node } })
      const next = applyOp(
        { type: 'set_node_state', nodeId: 'node-1', patch: { 'reading.lifecycle': { status: 'active', startedAt: '2026-04-01' } } },
        rev,
      )
      expect(next.nodes['node-1'].state['reading.lifecycle']).toEqual({ status: 'active', startedAt: '2026-04-01' })
    })

    it('throws if the node does not exist', () => {
      const rev = makeRevision()
      expect(() => applyOp({ type: 'set_node_state', nodeId: 'missing', patch: {} }, rev)).toThrow()
    })
  })

  describe('archive_node', () => {
    it('sets archived: true on the node', () => {
      const node = makeNode()
      const rev = makeRevision({ nodes: { 'node-1': node } })
      const next = applyOp({ type: 'archive_node', nodeId: 'node-1' }, rev)
      expect(next.nodes['node-1'].archived).toBe(true)
    })
  })

  describe('create_edge', () => {
    it('adds the edge to the revision', () => {
      const rev = makeRevision()
      const edge = makeEdge()
      const next = applyOp({ type: 'create_edge', edge }, rev)
      expect(next.edges['edge-1']).toEqual(edge)
    })

    it('throws if an edge with the same id already exists', () => {
      const edge = makeEdge()
      const rev = makeRevision({ edges: { 'edge-1': edge } })
      expect(() => applyOp({ type: 'create_edge', edge }, rev)).toThrow()
    })
  })

  describe('remove_edge', () => {
    it('removes the edge from the revision', () => {
      const edge = makeEdge()
      const rev = makeRevision({ edges: { 'edge-1': edge } })
      const next = applyOp({ type: 'remove_edge', edgeId: 'edge-1' }, rev)
      expect(next.edges['edge-1']).toBeUndefined()
    })

    it('throws if the edge does not exist', () => {
      const rev = makeRevision()
      expect(() => applyOp({ type: 'remove_edge', edgeId: 'missing' }, rev)).toThrow()
    })
  })

  describe('express_trait', () => {
    it('adds the trait URI to the node', () => {
      const node = makeNode()
      const rev = makeRevision({ nodes: { 'node-1': node } })
      const next = applyOp({ type: 'express_trait', nodeId: 'node-1', trait: 'pkg://reading/book@v1#reading.lifecycle' }, rev)
      expect(next.nodes['node-1'].traits).toContain('pkg://reading/book@v1#reading.lifecycle')
    })

    it('is idempotent — does not duplicate trait', () => {
      const node = makeNode({ traits: ['pkg://reading/book@v1#reading.lifecycle'] })
      const rev = makeRevision({ nodes: { 'node-1': node } })
      const next = applyOp({ type: 'express_trait', nodeId: 'node-1', trait: 'pkg://reading/book@v1#reading.lifecycle' }, rev)
      expect(next.nodes['node-1'].traits).toHaveLength(1)
    })
  })

  describe('remove_trait', () => {
    it('removes the trait URI from the node', () => {
      const node = makeNode({ traits: ['pkg://reading/book@v1#reading.lifecycle'] })
      const rev = makeRevision({ nodes: { 'node-1': node } })
      const next = applyOp({ type: 'remove_trait', nodeId: 'node-1', trait: 'pkg://reading/book@v1#reading.lifecycle' }, rev)
      expect(next.nodes['node-1'].traits).not.toContain('pkg://reading/book@v1#reading.lifecycle')
    })
  })
})
