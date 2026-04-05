import type { WorldRevision, NodeRecord, EdgeRecord } from '../types.js'

export type RevisionDiff = {
  nodes: {
    added: NodeRecord[]
    modified: NodeRecord[]
    removed: NodeRecord[]
  }
  edges: {
    added: EdgeRecord[]
    removed: EdgeRecord[]
  }
}

/**
 * Compare two revisions and return what changed between them.
 * "added" means present in revB but not revA; "removed" means the opposite.
 */
export function diffRevisions(revA: WorldRevision, revB: WorldRevision): RevisionDiff {
  const added: NodeRecord[] = []
  const modified: NodeRecord[] = []
  const removed: NodeRecord[] = []

  const allNodeIds = new Set([...Object.keys(revA.nodes), ...Object.keys(revB.nodes)])
  for (const id of allNodeIds) {
    const a = revA.nodes[id]
    const b = revB.nodes[id]
    if (!a) added.push(b)
    else if (!b) removed.push(a)
    else if (JSON.stringify(a) !== JSON.stringify(b)) modified.push(b)
  }

  const addedEdges: EdgeRecord[] = []
  const removedEdges: EdgeRecord[] = []

  const allEdgeIds = new Set([...Object.keys(revA.edges), ...Object.keys(revB.edges)])
  for (const id of allEdgeIds) {
    const a = revA.edges[id]
    const b = revB.edges[id]
    if (!a) addedEdges.push(b)
    else if (!b) removedEdges.push(a)
  }

  return {
    nodes: { added, modified, removed },
    edges: { added: addedEdges, removed: removedEdges },
  }
}
