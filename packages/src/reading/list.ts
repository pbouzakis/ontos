import { randomUUID } from 'crypto'
import type { TraitDefinition } from '@ontos/kernel'

export const listTrait: TraitDefinition = {
  uri: 'pkg://reading/list@v1#reading.list',
  description: 'Manages a reading list — add and remove book edges.',
  ownsState: {},
  handles: {
    add_book(ctx, msg) {
      const bookNodeId = msg.payload?.bookNodeId
      if (typeof bookNodeId !== 'string') {
        throw new Error('add_book requires payload.bookNodeId (string)')
      }
      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'create_edge',
            edge: {
              id: randomUUID(),
              type: 'reading.list.contains',
              from: ctx.node.id,
              to: bookNodeId,
              createdAt: ctx.now,
              updatedAt: ctx.now,
            },
          },
        }],
      }
    },
    remove_book(_ctx, msg) {
      const edgeId = msg.payload?.edgeId
      if (typeof edgeId !== 'string') {
        throw new Error('remove_book requires payload.edgeId (string)')
      }
      return {
        effects: [{
          type: 'apply_op',
          op: { type: 'remove_edge', edgeId },
        }],
      }
    },
  },
}
