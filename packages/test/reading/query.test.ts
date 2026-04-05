import { describe, it, expect } from 'vitest'
import { queryTrait } from '../../src/reading/query.js'
import type { TraitContext, WorldRevision, NodeRecord, EdgeRecord } from '@ontos/kernel'

function makeBook(id: string, slug: string, status: string, startedAt?: string): NodeRecord {
  return {
    id,
    slug,
    kinds: ['book'],
    url: `/worlds/test/nodes/${slug}`,
    state: { 'reading.lifecycle': { status, startedAt } },
    traits: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

function makeEdge(from: string, to: string): EdgeRecord {
  return {
    id: `edge-${from}-${to}`,
    type: 'reading.list.contains',
    from,
    to,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

function makeRevision(
  nodes: NodeRecord[],
  edges: EdgeRecord[],
): WorldRevision {
  return {
    id: 'r1',
    worldName: 'test',
    branchName: 'main',
    createdAt: '2024-01-01T00:00:00.000Z',
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
  }
}

function makeCtx(revision: WorldRevision): TraitContext {
  return {
    node: {
      id: 'derived-1',
      slug: 'latest-active-book',
      kinds: ['derived'],
      url: '/worlds/test/nodes/latest-active-book',
      state: {},
      traits: [queryTrait.uri],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    revision,
    now: '2024-06-01T10:00:00.000Z',
  }
}

describe('queryTrait (latestActiveBook)', () => {
  it('returns null latestActiveBookId when no active books', () => {
    const book = makeBook('b1', 'moby-dick', 'want_to_read')
    const rev = makeRevision([book], [makeEdge('list-1', 'b1')])
    const ctx = makeCtx(rev)
    const result = queryTrait.handles.recompute(ctx, { type: 'recompute' })
    const op = (result.effects ?? [])[0]
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['latestActiveBook']?.latestActiveBookId).toBeNull()
    }
  })

  it('returns the active book ID when one book is active', () => {
    const book = makeBook('b1', 'paradise-lost', 'active', '2024-05-01T00:00:00.000Z')
    const rev = makeRevision([book], [makeEdge('list-1', 'b1')])
    const ctx = makeCtx(rev)
    const result = queryTrait.handles.recompute(ctx, { type: 'recompute' })
    const op = (result.effects ?? [])[0]
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['latestActiveBook']?.latestActiveBookId).toBe('b1')
    }
  })

  it('returns the most-recently-started active book when multiple are active', () => {
    const b1 = makeBook('b1', 'book-a', 'active', '2024-03-01T00:00:00.000Z')
    const b2 = makeBook('b2', 'book-b', 'active', '2024-05-01T00:00:00.000Z')
    const rev = makeRevision([b1, b2], [makeEdge('list-1', 'b1'), makeEdge('list-1', 'b2')])
    const ctx = makeCtx(rev)
    const result = queryTrait.handles.recompute(ctx, { type: 'recompute' })
    const op = (result.effects ?? [])[0]
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['latestActiveBook']?.latestActiveBookId).toBe('b2')
    }
  })
})
