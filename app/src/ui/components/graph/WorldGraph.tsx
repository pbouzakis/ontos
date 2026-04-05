import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ApiNode, ApiEdge } from '../../api/client'

type Props = {
  nodes: ApiNode[]
  edges: ApiEdge[]
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

/** Assign a simple grid position to each node by index. */
function layoutNodes(nodes: ApiNode[]): Node[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  return nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 120 },
    data: { label: n.name ?? n.slug, slug: n.slug, kinds: n.kinds },
    style: n.archived ? { opacity: 0.4 } : undefined,
  }))
}

function toFlowEdges(edges: ApiEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.type,
  }))
}

export function WorldGraph({ nodes, edges, selectedNodeId, onSelectNode }: Props) {
  const flowNodes = layoutNodes(nodes).map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
  }))
  const flowEdges = toFlowEdges(edges)

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => onSelectNode(node.id),
    [onSelectNode],
  )

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
