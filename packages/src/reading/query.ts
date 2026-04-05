import type { TraitDefinition } from '@ontos/kernel'

export const queryTrait: TraitDefinition = {
  uri: 'pkg://reading/query@v1#latestActiveBook',
  description: 'Derived node: recomputes the latest active book node ID from the reading list.',
  ownsState: {
    latestActiveBookId: { type: 'string' },
  },
  handles: {
    recompute(ctx) {
      // Find the reading list edges connected to this node's world revision
      // and look for a book node with status 'active'.
      const revision = ctx.revision
      const edges = Object.values(revision.edges).filter(
        (e) => e.type === 'reading.list.contains',
      )
      let latestActiveBookId: string | null = null
      let latestStartedAt: string | null = null

      for (const edge of edges) {
        const book = revision.nodes[edge.to]
        if (!book) continue
        const lifecycle = book.state['reading.lifecycle'] as
          | { status?: string; startedAt?: string }
          | undefined
        if (lifecycle?.status === 'active') {
          const startedAt = lifecycle.startedAt ?? ''
          if (!latestStartedAt || startedAt > latestStartedAt) {
            latestStartedAt = startedAt
            latestActiveBookId = book.id
          }
        }
      }

      return {
        effects: [{
          type: 'apply_op',
          op: {
            type: 'set_node_state',
            nodeId: ctx.node.id,
            patch: {
              latestActiveBook: { latestActiveBookId },
            },
          },
        }],
      }
    },
  },
}
