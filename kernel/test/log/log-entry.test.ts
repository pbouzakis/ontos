import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JsonFileStore } from '../../src/store/json-file-store'
import { RevisionStore } from '../../src/world/revision-store'
import { createLogEntry } from '../../src/log/log-entry'
import type { LogEntryCause } from '../../src/types'

describe('createLogEntry', () => {
  it('creates a log entry with a unique id and timestamp', () => {
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }
    const entry = createLogEntry({ revisionId: 'rev-1', branchName: 'main', cause, effects: [], appliedOps: [] })
    expect(entry.id).toBeTruthy()
    expect(entry.revisionId).toBe('rev-1')
    expect(entry.branchName).toBe('main')
    expect(entry.cause).toEqual(cause)
    expect(entry.effects).toEqual([])
    expect(entry.appliedOps).toEqual([])
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN()
  })

  it('includes parentRevisionId when provided', () => {
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }
    const entry = createLogEntry({
      revisionId: 'rev-2',
      parentRevisionId: 'rev-1',
      branchName: 'main',
      cause,
      effects: [],
      appliedOps: [],
    })
    expect(entry.parentRevisionId).toBe('rev-1')
  })
})

describe('RevisionStore.getLogEntries', () => {
  let dir: string
  let store: RevisionStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ontos-log-'))
    store = new RevisionStore(new JsonFileStore(dir))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns log entries in insertion order', async () => {
    await store.createWorld('w1')
    const cause: LogEntryCause = { type: 'runtime', description: 'second entry' }
    await store.saveRevision('w1', 'main', { revisionId: 'rev-2', cause, effects: [], appliedOps: [] })

    const entries = await store.getLogEntries('w1', 'main')
    expect(entries.length).toBeGreaterThanOrEqual(2)
    // bootstrap entry is first
    expect(entries[0].cause).toMatchObject({ type: 'runtime', description: 'world bootstrap' })
    // our entry is last
    expect(entries[entries.length - 1].cause).toMatchObject({ type: 'runtime', description: 'second entry' })
  })

  it('returns empty array for unknown world', async () => {
    const entries = await store.getLogEntries('no-such-world', 'main')
    expect(entries).toEqual([])
  })
})
