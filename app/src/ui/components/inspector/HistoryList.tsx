import type { ApiRevision } from '../../api/client'

type Props = {
  revisions: ApiRevision[]
  nodeId: string
}

function formatCause(cause: { type: string; [k: string]: unknown }): string {
  if (cause.type === 'message') {
    const msg = cause['message'] as { type: string }
    return `message(${msg.type})`
  }
  if (cause.type === 'operation') {
    const op = cause['operation'] as { type: string }
    return `op(${op.type})`
  }
  return `runtime: ${String(cause['description'] ?? '')}`
}

export function HistoryList({ revisions, nodeId: _nodeId }: Props) {
  const sorted = [...revisions].reverse()

  if (sorted.length === 0) {
    return <div style={{ color: '#888', fontSize: 13 }}>No history.</div>
  }

  return (
    <div style={{ fontSize: 12 }}>
      {sorted.map((r) => (
        <div
          key={r.id}
          style={{ display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #2a2a2a' }}
        >
          <span style={{ color: '#666', fontFamily: 'monospace' }}>{r.id.slice(0, 8)}</span>
          <span style={{ color: '#aaa' }}>{r.timestamp.slice(0, 19).replace('T', ' ')}</span>
          <span>{formatCause(r.cause)}</span>
        </div>
      ))}
    </div>
  )
}
