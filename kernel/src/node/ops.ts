import type { WorldRevision, WorldOp, NodeRecord } from '../types'

/**
 * Apply a single WorldOp to a revision, returning a new revision.
 * Pure function — never mutates the input revision.
 */
export function applyOp(op: WorldOp, revision: WorldRevision): WorldRevision {
  switch (op.type) {
    case 'create_node': {
      const node = op.node as NodeRecord
      if (revision.nodes[node.id]) {
        throw new Error(`Node "${node.id}" already exists in revision "${revision.id}"`)
      }
      const url = node.url ?? `/worlds/${revision.worldName}/nodes/${node.slug}`
      return {
        ...revision,
        nodes: { ...revision.nodes, [node.id]: { ...node, url } },
      }
    }

    case 'set_node_state': {
      const existing = revision.nodes[op.nodeId]
      if (!existing) {
        throw new Error(`Node "${op.nodeId}" not found in revision "${revision.id}"`)
      }
      const mergedState = mergeState(existing.state, op.patch)
      return {
        ...revision,
        nodes: {
          ...revision.nodes,
          [op.nodeId]: { ...existing, state: mergedState, updatedAt: new Date().toISOString() },
        },
      }
    }

    case 'archive_node': {
      const existing = revision.nodes[op.nodeId]
      if (!existing) {
        throw new Error(`Node "${op.nodeId}" not found in revision "${revision.id}"`)
      }
      return {
        ...revision,
        nodes: {
          ...revision.nodes,
          [op.nodeId]: { ...existing, archived: true, updatedAt: new Date().toISOString() },
        },
      }
    }

    case 'create_edge': {
      if (revision.edges[op.edge.id]) {
        throw new Error(`Edge "${op.edge.id}" already exists in revision "${revision.id}"`)
      }
      return {
        ...revision,
        edges: { ...revision.edges, [op.edge.id]: op.edge },
      }
    }

    case 'remove_edge': {
      if (!revision.edges[op.edgeId]) {
        throw new Error(`Edge "${op.edgeId}" not found in revision "${revision.id}"`)
      }
      const { [op.edgeId]: _removed, ...remainingEdges } = revision.edges
      return { ...revision, edges: remainingEdges }
    }

    case 'express_trait': {
      const existing = revision.nodes[op.nodeId]
      if (!existing) {
        throw new Error(`Node "${op.nodeId}" not found in revision "${revision.id}"`)
      }
      if (existing.traits.includes(op.trait)) return revision // idempotent
      return {
        ...revision,
        nodes: {
          ...revision.nodes,
          [op.nodeId]: {
            ...existing,
            traits: [...existing.traits, op.trait],
            updatedAt: new Date().toISOString(),
          },
        },
      }
    }

    case 'remove_trait': {
      const existing = revision.nodes[op.nodeId]
      if (!existing) {
        throw new Error(`Node "${op.nodeId}" not found in revision "${revision.id}"`)
      }
      return {
        ...revision,
        nodes: {
          ...revision.nodes,
          [op.nodeId]: {
            ...existing,
            traits: existing.traits.filter((t) => t !== op.trait),
            updatedAt: new Date().toISOString(),
          },
        },
      }
    }

    default: {
      const _exhaustive: never = op
      throw new Error(`Unhandled op type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** Deep-merge state namespaces. Each namespace is merged shallowly (one level). */
function mergeState(
  current: Record<string, Record<string, unknown>>,
  patch: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const result = { ...current }
  for (const [ns, fields] of Object.entries(patch)) {
    result[ns] = { ...(current[ns] ?? {}), ...fields }
  }
  return result
}
