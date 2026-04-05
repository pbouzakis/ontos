import type { TraitDefinition, TraitUri } from '../types.js'

export class TraitRegistry {
  private readonly traits = new Map<TraitUri, TraitDefinition>()

  register(def: TraitDefinition): void {
    if (this.traits.has(def.uri)) {
      throw new Error(`Trait already registered: ${def.uri}`)
    }
    this.traits.set(def.uri, def)
  }

  get(uri: TraitUri): TraitDefinition {
    const def = this.resolve(uri)
    if (!def) throw new Error(`Trait not found: ${uri}`)
    return def
  }

  has(uri: TraitUri): boolean {
    return this.resolve(uri) !== null
  }

  /**
   * Resolve a trait by exact URI or by the fragment portion (after `#`).
   * Returns null if not found.
   */
  resolve(uriOrAlias: TraitUri): TraitDefinition | null {
    if (this.traits.has(uriOrAlias)) return this.traits.get(uriOrAlias)!
    for (const def of this.traits.values()) {
      const fragment = def.uri.split('#')[1]
      if (fragment === uriOrAlias) return def
    }
    return null
  }

  list(): TraitDefinition[] {
    return Array.from(this.traits.values())
  }
}
