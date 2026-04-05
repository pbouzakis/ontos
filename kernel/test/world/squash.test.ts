import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { JsonFileStore } from '../../src/store/json-file-store'
import { RevisionStore } from '../../src/world/revision-store'
import type { LogEntryCause } from '../../src/types'

describe('RevisionStore.squashRevisions', () => {
  let dir: string
  let store: RevisionStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ontos-squash-'))
    store = new RevisionStore(new JsonFileStore(dir))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  async function seedWorld(name: string) {
    await store.createWorld(name)
    const cause: LogEntryCause = { type: 'runtime', description: 'test' }
    const now = new Date().toISOString()

    const rev1 = randomUUID()
    const n1 = randomUUID()
    await store.saveRevision(name, 'main', {
      revisionId: rev1,
      cause,
      effects: [],
      appliedOps: [{ type: 'create_node', node: { id: n1, slug: 'alpha', kinds: [], url: '/n/alpha', state: {}, traits: [], createdAt: now, updatedAt: now } }],
    })

    const rev2 = randomUUID()
    const n2 = randomUUID()
    await store.saveRevision(name, 'main', {
      revisionId: rev2,
      cause,
      effects: [],
      appliedOps: [{ type: 'create_node', node: { id: n2, slug: 'beta', kinds: [], url: '/n/beta', state: {}, traits: [], createdAt: now, updatedAt: now } }],
    })

    const rev3 = randomUUID()
    const n3 = randomUUID()
    await store.saveRevision(name, 'main', {
      revisionId: rev3,
      cause,
      effects: [],
      appliedOps: [{ type: 'create_node', node: { id: n3, slug: 'gamma', kinds: [], url: '/n/gamma', state: {}, traits: [], createdAt: now, updatedAt: now } }],
    })

    return { rev1, rev2, rev3, n1, n2, n3 }
  }

  it('world reloads correctly after squash', async () => {
    const { rev1, rev3, n1, n2, n3 } = await seedWorld('w')

    await store.squashRevisions('w', 'main', rev1, rev3)

    const head = await store.getCurrentRevision('w', 'main')
    expect(head).not.toBeNull()
    expect(head!.nodes[n1]?.slug).toBe('alpha')
    expect(head!.nodes[n2]?.slug).toBe('beta')
    expect(head!.nodes[n3]?.slug).toBe('gamma')
  })

  it('getLogEntries returns squash marker instead of individual entries', async () => {
    const { rev1, rev3 } = await seedWorld('w')

    await store.squashRevisions('w', 'main', rev1, rev3)

    const entries = await store.getLogEntries('w', 'main')
    const squashEntry = entries.find((e) => e.cause.type === 'runtime' && (e.cause as { description: string }).description.startsWith('squash'))
    expect(squashEntry).toBeDefined()

    // Individual rev1, rev2, rev3 entries are gone; only squash marker remains in their place
    const individualRevIds = entries.filter((e) => e.revisionId === rev1 || e.revisionId === rev3)
    // The squash marker has revisionId === toRevId (rev3), but not rev1
    const rev1Entry = entries.find((e) => e.cause.type === 'runtime' && (e.cause as { description: string }).description === 'test' && e.revisionId === rev1)
    expect(rev1Entry).toBeUndefined()
  })

  it('entries after squash range are preserved', async () => {
    const { rev1, rev2 } = await seedWorld('w')

    // Squash first two revisions, keep third
    await store.squashRevisions('w', 'main', rev1, rev2)

    const entries = await store.getLogEntries('w', 'main')
    const squashEntry = entries.find((e) => e.cause.type === 'runtime' && (e.cause as { description: string }).description.startsWith('squash'))
    expect(squashEntry).toBeDefined()

    // rev3 entry (added after range) should still be present
    const postSquashEntries = entries.filter((e) => e.cause.type === 'runtime' && (e.cause as { description: string }).description === 'test')
    expect(postSquashEntries.length).toBeGreaterThan(0)
  })

  it('throws if toRevId not found after fromRevId', async () => {
    const { rev1 } = await seedWorld('w')
    await expect(
      store.squashRevisions('w', 'main', rev1, 'nonexistent')
    ).rejects.toThrow()
  })
})
