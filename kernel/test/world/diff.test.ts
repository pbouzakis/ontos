import { describe, it, expect } from 'vitest'
import { diffRevisions } from '../../src/world/diff'
import type { WorldRevision, NodeRecord, EdgeRecord } from '../../src/types'

function makeRev(
  id: string,
  nodes: NodeRecord[] = [],
  edges: EdgeRecord[] = [],
): WorldRevision {
  return {
    id,
    worldName: 'test',
    branchName: 'main',
    createdAt: '2024-01-01T00:00:00Z',
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
  }
}

function makeNode(id: string, slug: string, extra?: Partial<NodeRecord>): NodeRecord {
  return {
    id,
    slug,
    kinds: [],
    url: `/nodes/${slug}`,
    state: {},
    traits: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...extra,
  }
}

function makeEdge(id: string, type: string, from: string, to: string): EdgeRecord {
  return { id, type, from, to, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
}

describe('diffRevisions', () => {
  it('returns empty diff for identical revisions', () => {
    const node = makeNode('n1', 'root')
    const rev = makeRev('r1', [node])
    const diff = diffRevisions(rev, rev)
    expect(diff.nodes.added).toHaveLength(0)
    expect(diff.nodes.modified).toHaveLength(0)
    expect(diff.nodes.removed).toHaveLength(0)
    expect(diff.edges.added).toHaveLength(0)
    expect(diff.edges.removed).toHaveLength(0)
  })

  it('detects added node', () => {
    const n1 = makeNode('n1', 'root')
    const n2 = makeNode('n2', 'book')
    const revA = makeRev('r1', [n1])
    const revB = makeRev('r2', [n1, n2])
    const diff = diffRevisions(revA, revB)
    expect(diff.nodes.added).toHaveLength(1)
    expect(diff.nodes.added[0].slug).toBe('book')
    expect(diff.nodes.modified).toHaveLength(0)
    expect(diff.nodes.removed).toHaveLength(0)
  })

  it('detects removed node', () => {
    const n1 = makeNode('n1', 'root')
    const n2 = makeNode('n2', 'book')
    const revA = makeRev('r1', [n1, n2])
    const revB = makeRev('r2', [n1])
    const diff = diffRevisions(revA, revB)
    expect(diff.nodes.removed).toHaveLength(1)
    expect(diff.nodes.removed[0].slug).toBe('book')
    expect(diff.nodes.added).toHaveLength(0)
    expect(diff.nodes.modified).toHaveLength(0)
  })

  it('detects modified node state', () => {
    const n1 = makeNode('n1', 'book', { state: { 'reading.lifecycle': { status: 'want_to_read' } } })
    const n1b = makeNode('n1', 'book', { state: { 'reading.lifecycle': { status: 'active' } } })
    const revA = makeRev('r1', [n1])
    const revB = makeRev('r2', [n1b])
    const diff = diffRevisions(revA, revB)
    expect(diff.nodes.modified).toHaveLength(1)
    expect(diff.nodes.modified[0].state['reading.lifecycle']).toEqual({ status: 'active' })
    expect(diff.nodes.added).toHaveLength(0)
    expect(diff.nodes.removed).toHaveLength(0)
  })

  it('detects added edge', () => {
    const revA = makeRev('r1', [], [])
    const e1 = makeEdge('e1', 'contains', 'n1', 'n2')
    const revB = makeRev('r2', [], [e1])
    const diff = diffRevisions(revA, revB)
    expect(diff.edges.added).toHaveLength(1)
    expect(diff.edges.added[0].id).toBe('e1')
    expect(diff.edges.removed).toHaveLength(0)
  })

  it('detects removed edge', () => {
    const e1 = makeEdge('e1', 'contains', 'n1', 'n2')
    const revA = makeRev('r1', [], [e1])
    const revB = makeRev('r2', [], [])
    const diff = diffRevisions(revA, revB)
    expect(diff.edges.removed).toHaveLength(1)
    expect(diff.edges.removed[0].id).toBe('e1')
    expect(diff.edges.added).toHaveLength(0)
  })
})
