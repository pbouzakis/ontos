import { useState, useEffect, useCallback } from 'react'
import { OntosClient, fetchServerConfig, type ApiNode, type ApiRevision } from './api/client'
import { WorldGraph } from './components/graph/WorldGraph'
import { NodeInspector } from './components/inspector/NodeInspector'
import { ShellPanel } from './components/shell/ShellPanel'

const client = new OntosClient('', '')

export function App() {
  const [world, setWorld] = useState('')
  const [branch, setBranch] = useState('')
  const [nodes, setNodes] = useState<ApiNode[]>([])
  const [revisions, setRevisions] = useState<ApiRevision[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [shellOpen, setShellOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Fetch world/branch config from server on mount
  useEffect(() => {
    fetchServerConfig()
      .then((cfg) => {
        client.setConfig(cfg.world, cfg.branch)
        setWorld(cfg.world)
        setBranch(cfg.branch)
        setReady(true)
      })
      .catch((err: unknown) => setError(String(err)))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [n, r] = await Promise.all([client.listNodes(), client.listRevisions()])
      setNodes(n)
      setRevisions(r)
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void refresh()
    const unsub = client.subscribeToEvents(() => void refresh())
    return unsub
  }, [ready, refresh])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault()
        setShellOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null
  const graphEdges: { id: string; type: string; from: string; to: string; createdAt: string; updatedAt: string }[] = []

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0d0d0d',
        color: '#e0e0e0',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 40,
          background: '#141414',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <strong>ontos</strong>
        <span style={{ color: '#555' }}>·</span>
        <span style={{ color: '#888' }}>{world || '…'}/{branch || '…'}</span>
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 12 }}>
          {nodes.length} nodes · press ` for shell
        </span>
      </div>

      {error && (
        <div style={{ background: '#3b1010', color: '#f87171', padding: '6px 16px', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <WorldGraph
          nodes={nodes}
          edges={graphEdges}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />

        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            revisions={revisions}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        <ShellPanel
          client={client}
          open={shellOpen}
          onToggle={() => setShellOpen(false)}
        />
      </div>
    </div>
  )
}
