import { describe, it, expect } from 'vitest'
import { bookTrait } from '../../src/reading/book.js'
import type { TraitContext } from '@ontos/kernel'

function makeCtx(state: Record<string, unknown> = {}): TraitContext {
  return {
    node: {
      id: 'node-1',
      slug: 'paradise-lost',
      name: 'Paradise Lost',
      kinds: ['book'],
      url: '/worlds/test/nodes/paradise-lost',
      state: { 'reading.lifecycle': state },
      traits: [bookTrait.uri],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    revision: { id: 'r1', worldName: 'test', branchName: 'main', createdAt: '2024-01-01T00:00:00.000Z', nodes: {}, edges: {} },
    now: '2024-06-01T10:00:00.000Z',
  }
}

describe('bookTrait (reading.lifecycle)', () => {
  it('mark_want_to_read sets status to want_to_read', () => {
    const ctx = makeCtx({ status: 'active' })
    const result = bookTrait.handles.mark_want_to_read(ctx, { type: 'mark_want_to_read' })
    const op = (result.effects ?? [])[0]
    expect(op?.type).toBe('apply_op')
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['reading.lifecycle']?.status).toBe('want_to_read')
    }
  })

  it('mark_active sets status to active and records startedAt', () => {
    const ctx = makeCtx({ status: 'want_to_read' })
    const result = bookTrait.handles.mark_active(ctx, { type: 'mark_active' })
    const op = (result.effects ?? [])[0]
    expect(op?.type).toBe('apply_op')
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['reading.lifecycle']?.status).toBe('active')
      expect(op.op.patch['reading.lifecycle']?.startedAt).toBe(ctx.now)
    }
  })

  it('mark_finished sets status to finished and records finishedAt', () => {
    const ctx = makeCtx({ status: 'active' })
    const result = bookTrait.handles.mark_finished(ctx, { type: 'mark_finished' })
    const op = (result.effects ?? [])[0]
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['reading.lifecycle']?.status).toBe('finished')
      expect(op.op.patch['reading.lifecycle']?.finishedAt).toBe(ctx.now)
    }
  })

  it('mark_inactive sets status to inactive', () => {
    const ctx = makeCtx({ status: 'active' })
    const result = bookTrait.handles.mark_inactive(ctx, { type: 'mark_inactive' })
    const op = (result.effects ?? [])[0]
    if (op?.type === 'apply_op' && op.op.type === 'set_node_state') {
      expect(op.op.patch['reading.lifecycle']?.status).toBe('inactive')
    }
  })
})
