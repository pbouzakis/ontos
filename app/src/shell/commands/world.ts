import type { RevisionDiff } from '@ontos/kernel'
import type { ShellContext } from '../context.js'

export async function worldShow(ctx: ShellContext): Promise<void> {
  const rev = await ctx.api.getRevision(ctx.world, ctx.branch)
  if (!rev) {
    console.log(`World "${ctx.world}" not found`)
    return
  }
  console.log(`world:    ${ctx.world}`)
  console.log(`branch:   ${ctx.branch}`)
  console.log(`revision: ${rev.id}`)
  console.log(`created:  ${rev.createdAt}`)
}

export async function worldHistory(ctx: ShellContext): Promise<void> {
  const entries = await ctx.api.getLog(ctx.world, ctx.branch)
  if (entries.length === 0) {
    console.log('No log entries.')
    return
  }
  for (const e of entries) {
    const cause = formatCause(e.cause)
    console.log(`[${e.timestamp}] ${e.revisionId.slice(0, 8)} — ${cause}`)
  }
}

export async function worldDiff(ctx: ShellContext, revAId: string, revBId: string): Promise<void> {
  let diff: RevisionDiff
  try {
    diff = await ctx.api.diffRevisions(ctx.world, ctx.branch, revAId, revBId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    return
  }

  const { nodes, edges } = diff
  const total = nodes.added.length + nodes.modified.length + nodes.removed.length + edges.added.length + edges.removed.length
  if (total === 0) {
    console.log('No differences between the two revisions.')
    return
  }

  for (const n of nodes.added) console.log(`+ node  ${n.id.slice(0, 8)}  ${n.slug}`)
  for (const n of nodes.modified) console.log(`~ node  ${n.id.slice(0, 8)}  ${n.slug}`)
  for (const n of nodes.removed) console.log(`- node  ${n.id.slice(0, 8)}  ${n.slug}`)
  for (const e of edges.added) console.log(`+ edge  ${e.id.slice(0, 8)}  ${e.type} ${e.from.slice(0, 8)} → ${e.to.slice(0, 8)}`)
  for (const e of edges.removed) console.log(`- edge  ${e.id.slice(0, 8)}  ${e.type} ${e.from.slice(0, 8)} → ${e.to.slice(0, 8)}`)
}

function formatCause(cause: { type: string; [k: string]: unknown }): string {
  if (cause.type === 'message') {
    const msg = cause.message as { type: string }
    return `message(${msg.type}) → node:${String(cause.targetNodeId).slice(0, 8)}`
  }
  if (cause.type === 'operation') {
    const op = cause.operation as { type: string }
    return `op(${op.type})`
  }
  return `runtime: ${String(cause.description ?? '')}`
}
