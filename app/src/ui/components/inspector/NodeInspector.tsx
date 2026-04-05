import { useEffect, useRef } from 'react'
import type { ApiNode, ApiRevision } from '../../api/client'
import { StateSection } from './StateSection'
import { HistoryList } from './HistoryList'

type Props = {
  node: ApiNode
  revisions: ApiRevision[]
  onClose: () => void
}

export function NodeInspector({ node, revisions, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 340,
        height: '100%',
        background: '#1a1a1a',
        borderLeft: '1px solid #333',
        overflowY: 'auto',
        padding: 16,
        zIndex: 10,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>{node.name ?? node.slug}</strong>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      </div>

      <Field label="id" value={node.id} mono />
      <Field label="slug" value={node.slug} mono />
      <Field label="url" value={node.url} mono />
      {node.kinds.length > 0 && <Field label="kinds" value={node.kinds.join(', ')} />}
      {node.traits.length > 0 && <Field label="traits" value={node.traits.join(', ')} />}

      {Object.keys(node.state).length > 0 && (
        <section style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: '#ccc' }}>State</div>
          {Object.entries(node.state).map(([ns, s]) => (
            <StateSection key={ns} namespace={ns} state={s} />
          ))}
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: '#ccc' }}>History</div>
        <HistoryList revisions={revisions} nodeId={node.id} />
      </section>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 13 }}>
      <span style={{ color: '#888', minWidth: 56 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : undefined, color: '#ddd', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}
