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
    const def = this.traits.get(uri)
    if (!def) throw new Error(`Trait not found: ${uri}`)
    return def
  }

  has(uri: TraitUri): boolean {
    return this.traits.has(uri)
  }

  list(): TraitDefinition[] {
    return Array.from(this.traits.values())
  }
}
