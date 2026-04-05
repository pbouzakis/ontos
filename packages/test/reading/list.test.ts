import { describe, it, expect } from 'vitest'
import { listTrait } from '../../src/reading/list.js'
import type { TraitContext } from '@ontos/kernel'

function makeCtx(): TraitContext {
  return {
    node: {
      id: 'list-node-1',
      slug: 'my-reading-list',
      kinds: ['reading-list'],
      url: '/worlds/test/nodes/my-reading-list',
      state: {},
      traits: [listTrait.uri],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    revision: { id: 'r1', worldName: 'test', branchName: 'main', createdAt: '2024-01-01T00:00:00.000Z', nodes: {}, edges: {} },
    now: '2024-06-01T10:00:00.000Z',
  }
}

describe('listTrait (reading.list)', () => {
  it('add_book produces a create_edge effect', () => {
    const ctx = makeCtx()
    const result = listTrait.handles.add_book(ctx, {
      type: 'add_book',
      payload: { bookNodeId: 'book-99' },
    })
    const op = (result.effects ?? [])[0]
    expect(op?.type).toBe('apply_op')
    if (op?.type === 'apply_op' && op.op.type === 'create_edge') {
      expect(op.op.edge.type).toBe('reading.list.contains')
      expect(op.op.edge.from).toBe('list-node-1')
      expect(op.op.edge.to).toBe('book-99')
    }
  })

  it('add_book throws if bookNodeId is missing', () => {
    const ctx = makeCtx()
    expect(() =>
      listTrait.handles.add_book(ctx, { type: 'add_book', payload: {} }),
    ).toThrow(/bookNodeId/)
  })

  it('remove_book produces a remove_edge effect', () => {
    const ctx = makeCtx()
    const result = listTrait.handles.remove_book(ctx, {
      type: 'remove_book',
      payload: { edgeId: 'edge-42' },
    })
    const op = (result.effects ?? [])[0]
    expect(op?.type).toBe('apply_op')
    if (op?.type === 'apply_op' && op.op.type === 'remove_edge') {
      expect(op.op.edgeId).toBe('edge-42')
    }
  })

  it('remove_book throws if edgeId is missing', () => {
    const ctx = makeCtx()
    expect(() =>
      listTrait.handles.remove_book(ctx, { type: 'remove_book', payload: {} }),
    ).toThrow(/edgeId/)
  })
})
