import { randomUUID } from 'crypto'
import type { ShellContext } from '../context.js'

export async function edgeList(ctx: ShellContext): Promise<void> {
  const rev = await ctx.api.getRevision(ctx.world, ctx.branch)
  if (!rev) { console.log('World not found'); return }
  const edges = Object.values(rev.edges)
  if (edges.length === 0) { console.log('No edges.'); return }
  for (const e of edges) {
    console.log(`  ${e.id.slice(0, 8)}  ${e.type}  ${e.from.slice(0, 8)} → ${e.to.slice(0, 8)}`)
  }
}

export async function edgeCreate(
  ctx: ShellContext,
  type: string,
  from: string,
  to: string,
): Promise<void> {
  const now = new Date().toISOString()
  // Resolve node IDs from slugs/ids
  const fromNode = await ctx.api.getNode(ctx.world, ctx.branch, from)
  const toNode = await ctx.api.getNode(ctx.world, ctx.branch, to)
  if (!fromNode) { console.error(`Node "${from}" not found`); return }
  if (!toNode) { console.error(`Node "${to}" not found`); return }

  const result = await ctx.api.applyOp(ctx.world, ctx.branch, {
    type: 'create_edge',
    edge: {
      id: randomUUID(),
      type,
      from: fromNode.id,
      to: toNode.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log(`Created edge ${type} (${from} → ${to}) → revision ${result.newRevisionId.slice(0, 8)}`)
}

export async function edgeRemove(ctx: ShellContext, edgeId: string): Promise<void> {
  const result = await ctx.api.applyOp(ctx.world, ctx.branch, {
    type: 'remove_edge',
    edgeId,
  })
  console.log(`Removed edge ${edgeId.slice(0, 8)} → revision ${result.newRevisionId.slice(0, 8)}`)
}
