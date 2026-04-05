import * as path from 'path'
import type { ShellContext } from '../context.js'

export async function pkgList(ctx: ShellContext): Promise<void> {
  const traits = ctx.api.listTraits()
  if (traits.length === 0) {
    console.log('No packages loaded.')
    return
  }
  // Group by package prefix (scheme + package name before the #fragment)
  const grouped = new Map<string, string[]>()
  for (const t of traits) {
    const pkg = t.uri.split('#')[0] ?? t.uri
    if (!grouped.has(pkg)) grouped.set(pkg, [])
    grouped.get(pkg)!.push(t.uri)
  }
  for (const [pkg, uris] of grouped) {
    console.log(`  ${pkg}`)
    for (const uri of uris) {
      console.log(`    - ${uri}`)
    }
  }
}

export async function pkgLoad(ctx: ShellContext, modulePath: string): Promise<void> {
  const resolved = path.resolve(process.cwd(), modulePath)
  const loaded = await ctx.api.loadPackage(resolved)
  console.log(`Loaded ${loaded.length} trait(s):`)
  for (const uri of loaded) {
    console.log(`  + ${uri}`)
  }
}

export async function traitInspect(ctx: ShellContext, uri: string): Promise<void> {
  const def = await ctx.api.getTrait(uri)
  if (!def) {
    console.log(`Trait "${uri}" not found (load the package first)`)
    return
  }
  console.log(`uri:         ${def.uri}`)
  if (def.description) console.log(`description: ${def.description}`)
  console.log(`handles:     ${Object.keys(def.handles).join(', ') || '(none)'}`)
  if (def.ownsState && Object.keys(def.ownsState).length > 0) {
    console.log('state:')
    for (const [k, spec] of Object.entries(def.ownsState)) {
      const req = spec.required ? ' (required)' : ''
      const def_ = spec.default !== undefined ? ` = ${JSON.stringify(spec.default)}` : ''
      console.log(`  ${k}: ${spec.type}${req}${def_}`)
    }
  }
  if (def.requiresTraits && def.requiresTraits.length > 0) {
    console.log(`requires:    ${def.requiresTraits.join(', ')}`)
  }
}
