import type { TraitDefinition } from '../types.js'
import { TraitRegistry } from './registry.js'

function isTraitDefinition(value: unknown): value is TraitDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TraitDefinition).uri === 'string' &&
    typeof (value as TraitDefinition).handles === 'object'
  )
}

/**
 * Dynamically imports a package module and registers all exported TraitDefinitions
 * into the provided registry.
 *
 * A "package" is any JS/TS module that exports one or more TraitDefinition objects
 * at the top level. Non-TraitDefinition exports are silently ignored.
 */
export async function loadPackage(
  modulePath: string,
  registry: TraitRegistry,
): Promise<TraitDefinition[]> {
  const mod: Record<string, unknown> = await import(modulePath)
  const loaded: TraitDefinition[] = []

  for (const [, value] of Object.entries(mod)) {
    if (isTraitDefinition(value)) {
      registry.register(value)
      loaded.push(value)
    }
  }

  return loaded
}
