import type { TraitDefinition } from '@ontos/kernel'

export type ReadingStatus = 'want_to_read' | 'active' | 'finished' | 'inactive'

export const bookTrait: TraitDefinition = {
  uri: 'pkg://reading/book@v1#reading.lifecycle',
  description: 'Tracks a book through the reading lifecycle.',
  ownsState: {
    status:     { type: 'string', required: true, default: 'want_to_read' },
    startedAt:  { type: 'string' },
    finishedAt: { type: 'string' },
  },
  defaultState: {
    status: 'want_to_read',
  },
  handles: {
    mark_want_to_read(ctx) {
      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'want_to_read', startedAt: null, finishedAt: null } },
          },
        }],
      }
    },
    mark_active(ctx) {
      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'active', startedAt: ctx.now } },
          },
        }],
      }
    },
    mark_finished(ctx) {
      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'finished', finishedAt: ctx.now } },
          },
        }],
      }
    },
    mark_inactive(ctx) {
      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: ctx.node.id,
            patch: { 'reading.lifecycle': { status: 'inactive' } },
          },
        }],
      }
    },
  },
}
