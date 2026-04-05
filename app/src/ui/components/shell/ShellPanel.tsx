import { useState, useRef, useEffect, useCallback } from 'react'
import type { OntosClient } from '../../api/client'

type OutputLine = { text: string; isErr: boolean }

type Props = {
  client: OntosClient
  open: boolean
  onToggle: () => void
}

export function ShellPanel({ client, open, onToggle }: Props) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const submit = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd) return

    setOutput((prev) => [...prev, { text: `> ${cmd}`, isErr: false }])
    setHistory((prev) => [cmd, ...prev])
    setHistoryIdx(-1)
    setInput('')

    try {
      const { stdout, stderr } = await client.execCommand(cmd)
      if (stdout) stdout.split('\n').filter(Boolean).forEach((l) => setOutput((p) => [...p, { text: l, isErr: false }]))
      if (stderr) stderr.split('\n').filter(Boolean).forEach((l) => setOutput((p) => [...p, { text: l, isErr: true }]))
    } catch (err) {
      setOutput((prev) => [...prev, { text: String(err), isErr: true }])
    }
  }, [client, input])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void submit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(idx)
      setInput(history[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(historyIdx - 1, -1)
      setHistoryIdx(idx)
      setInput(idx === -1 ? '' : (history[idx] ?? ''))
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 240,
        background: '#111',
        borderTop: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        fontFamily: 'monospace',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid #222',
          color: '#666',
          fontSize: 12,
        }}
      >
        <span>shell</span>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
        >
          ×
        </button>
      </div>
      <div
        ref={outputRef}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', color: '#ccc' }}
      >
        {output.map((line, i) => (
          <div key={i} style={{ color: line.isErr ? '#f87171' : '#ccc', whiteSpace: 'pre-wrap' }}>
            {line.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', padding: '4px 12px', borderTop: '1px solid #222' }}>
        <span style={{ color: '#666', marginRight: 8 }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: '#eee',
            outline: 'none',
            fontFamily: 'monospace',
            fontSize: 13,
          }}
          placeholder="type a command…"
        />
      </div>
    </div>
  )
}
