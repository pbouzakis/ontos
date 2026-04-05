type Props = {
  namespace: string
  state: Record<string, unknown>
}

export function StateSection({ namespace, state }: Props) {
  const entries = Object.entries(state)
  if (entries.length === 0) return null

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#888', marginBottom: 4 }}>
        {namespace}
      </div>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
          <span style={{ color: '#aaa', minWidth: 100 }}>{key}</span>
          <span>{JSON.stringify(value)}</span>
        </div>
      ))}
    </div>
  )
}
