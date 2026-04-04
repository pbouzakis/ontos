import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JsonFileStore } from '../../src/store/json-file-store'
import type { World } from '../../src/types'

function makeWorld(name: string): World {
  return {
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    branches: {},
    baseline: {
      id: 'baseline-1',
      worldName: name,
      branchName: 'main',
      createdAt: '2026-01-01T00:00:00.000Z',
      nodes: {},
      edges: {},
    },
    log: [],
  }
}

describe('JsonFileStore', () => {
  let dir: string
  let store: JsonFileStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ontos-test-'))
    store = new JsonFileStore(dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns null for a world that does not exist', async () => {
    const result = await store.loadWorld('nonexistent')
    expect(result).toBeNull()
  })

  it('saves and loads a world round-trip', async () => {
    const world = makeWorld('test-world')
    await store.saveWorld(world)
    const loaded = await store.loadWorld('test-world')
    expect(loaded).toEqual(world)
  })

  it('lists saved worlds', async () => {
    await store.saveWorld(makeWorld('alpha'))
    await store.saveWorld(makeWorld('beta'))
    const names = await store.listWorlds()
    expect(names).toContain('alpha')
    expect(names).toContain('beta')
    expect(names).toHaveLength(2)
  })

  it('overwrites an existing world on save', async () => {
    const world = makeWorld('my-world')
    await store.saveWorld(world)

    const updated = { ...world, createdAt: '2026-06-01T00:00:00.000Z' }
    await store.saveWorld(updated)

    const loaded = await store.loadWorld('my-world')
    expect(loaded?.createdAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('creates the data directory if it does not exist', async () => {
    const nested = join(dir, 'deep', 'nested')
    const nestedStore = new JsonFileStore(nested)
    const world = makeWorld('bootstrap')
    await expect(nestedStore.saveWorld(world)).resolves.not.toThrow()
    const loaded = await nestedStore.loadWorld('bootstrap')
    expect(loaded).toEqual(world)
  })
})
