import { describe, it, expect, beforeEach } from 'vitest'
import { TraitRegistry } from '../../src/trait/registry.js'
import { loadPackage } from '../../src/trait/loader.js'
import type { TraitDefinition } from '../../src/types.js'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const bookTrait: TraitDefinition = {
  uri: 'pkg://reading/book@v1#reading.lifecycle',
  description: 'Reading lifecycle',
  handles: {
    mark_active: () => ({ effects: [] }),
  },
}

const listTrait: TraitDefinition = {
  uri: 'pkg://reading/list@v1#reading.list',
  handles: {
    add_book: () => ({ effects: [] }),
  },
}

// ─── TraitRegistry ───────────────────────────────────────────────────────────

describe('TraitRegistry', () => {
  let registry: TraitRegistry

  beforeEach(() => {
    registry = new TraitRegistry()
  })

  it('registers and resolves a trait', () => {
    registry.register(bookTrait)
    expect(registry.get(bookTrait.uri)).toBe(bookTrait)
  })

  it('throws on duplicate URI', () => {
    registry.register(bookTrait)
    expect(() => registry.register(bookTrait)).toThrow(/already registered/)
  })

  it('throws on missing URI', () => {
    expect(() => registry.get('pkg://unknown@v1#nope')).toThrow(/not found/)
  })

  it('has() returns true/false correctly', () => {
    expect(registry.has(bookTrait.uri)).toBe(false)
    registry.register(bookTrait)
    expect(registry.has(bookTrait.uri)).toBe(true)
  })

  it('list() returns all registered traits', () => {
    registry.register(bookTrait)
    registry.register(listTrait)
    expect(registry.list()).toHaveLength(2)
  })
})

// ─── PackageLoader ────────────────────────────────────────────────────────────

describe('loadPackage', () => {
  it('loads trait definitions from a fixture module', async () => {
    const registry = new TraitRegistry()
    const fixturePath = resolve(__dirname, 'fixtures/sample-package.js')
    const loaded = await loadPackage(fixturePath, registry)
    expect(loaded).toHaveLength(1)
    expect(registry.has('pkg://fixture/sample@v1#fixture.trait')).toBe(true)
  })

  it('ignores non-TraitDefinition exports', async () => {
    const registry = new TraitRegistry()
    const fixturePath = resolve(__dirname, 'fixtures/sample-package.js')
    await loadPackage(fixturePath, registry)
    // Only the one trait, not the helper string export
    expect(registry.list()).toHaveLength(1)
  })

  it('throws on duplicate when loading same package twice', async () => {
    const registry = new TraitRegistry()
    const fixturePath = resolve(__dirname, 'fixtures/sample-package.js')
    await loadPackage(fixturePath, registry)
    await expect(loadPackage(fixturePath, registry)).rejects.toThrow(/already registered/)
  })

  it('returns empty array for module with no traits', async () => {
    const registry = new TraitRegistry()
    const fixturePath = resolve(__dirname, 'fixtures/empty-package.js')
    const loaded = await loadPackage(fixturePath, registry)
    expect(loaded).toHaveLength(0)
  })
})
