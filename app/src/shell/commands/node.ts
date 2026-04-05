import { randomUUID } from 'crypto'
import type { ShellContext } from '../context.js'

export async function nodeList(ctx: ShellContext): Promise<void> {
  const nodes = await ctx.api.listNodes(ctx.world, ctx.branch)
  if (nodes.length === 0) {
    console.log('No nodes.')
    return
  }
  for (const n of nodes) {
    const kinds = n.kinds.length > 0 ? ` [${n.kinds.join(', ')}]` : ''
    const traits = n.traits.length > 0 ? ` traits:${n.traits.length}` : ''
    console.log(`  ${n.id.slice(0, 8)}  ${n.slug}${kinds}${traits}  ${n.url}`)
  }
}

export async function nodeShow(ctx: ShellContext, idOrSlug: string): Promise<void> {
  const node = await ctx.api.getNode(ctx.world, ctx.branch, idOrSlug)
  if (!node) {
    console.log(`Node "${idOrSlug}" not found`)
    return
  }
  console.log(`id:       ${node.id}`)
  console.log(`slug:     ${node.slug}`)
  console.log(`name:     ${node.name ?? '(none)'}`)
  console.log(`url:      ${node.url}`)
  console.log(`kinds:    ${node.kinds.join(', ') || '(none)'}`)
  console.log(`traits:   ${node.traits.join(', ') || '(none)'}`)
  console.log(`created:  ${node.createdAt}`)
  console.log(`updated:  ${node.updatedAt}`)
  if (Object.keys(node.state).length > 0) {
    console.log('state:')
    for (const [ns, vals] of Object.entries(node.state)) {
      console.log(`  [${ns}]`)
      for (const [k, v] of Object.entries(vals)) {
        console.log(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
  }
}

export async function nodeInspect(ctx: ShellContext, idOrSlug: string): Promise<void> {
  const node = await ctx.api.getNode(ctx.world, ctx.branch, idOrSlug)
  if (!node) {
    console.log(`Node "${idOrSlug}" not found`)
    return
  }

  console.log('=== NODE RECORD ===')
  console.log(JSON.stringify(node, null, 2))

  const log = await ctx.api.getLog(ctx.world, ctx.branch)
  const relevant = log.filter((e) => {
    if (e.cause.type === 'message' && e.cause.targetNodeId === node.id) return true
    if (e.appliedOps.some((op) => 'nodeId' in op && op.nodeId === node.id)) return true
    if (e.appliedOps.some((op) => op.type === 'create_node' && op.node.id === node.id)) return true
    return false
  })

  console.log(`\n=== LOG ENTRIES (${relevant.length} touching this node) ===`)
  if (relevant.length === 0) {
    console.log('  (none)')
    return
  }
  for (const e of relevant) {
    console.log(`\n  [${e.timestamp}] rev:${e.revisionId.slice(0, 8)}`)
    console.log(`  cause: ${JSON.stringify(e.cause)}`)
    if (e.appliedOps.length > 0) {
      console.log(`  ops:   ${e.appliedOps.map((o) => o.type).join(', ')}`)
    }
  }
}

export async function nodeCreate(
  ctx: ShellContext,
  opts: { name?: string; kind?: string; slug?: string },
): Promise<void> {
  const now = new Date().toISOString()
  const slug = opts.slug ?? opts.name?.toLowerCase().replace(/\s+/g, '-') ?? `node-${Date.now()}`
  const kinds = opts.kind ? [opts.kind] : []

  const result = await ctx.api.applyOp(ctx.world, ctx.branch, {
    type: 'create_node',
    node: {
      id: randomUUID(),
      slug,
      name: opts.name,
      kinds,
      state: {},
      traits: [],
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log(`Created node "${slug}" → revision ${result.newRevisionId.slice(0, 8)}`)
}
