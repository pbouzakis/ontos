import type { ShellContext } from '../context.js'

export async function messageSend(
  ctx: ShellContext,
  nodeIdOrSlug: string,
  type: string,
  payloadJson?: string,
): Promise<void> {
  const payload = payloadJson ? (JSON.parse(payloadJson) as Record<string, unknown>) : undefined
  const result = await ctx.api.sendMessage(ctx.world, ctx.branch, nodeIdOrSlug, {
    type,
    payload,
    meta: { at: new Date().toISOString() },
  })
  console.log(`Message sent. New revision: ${result.newRevisionId.slice(0, 8)}`)
}

export async function messagePreview(
  ctx: ShellContext,
  nodeIdOrSlug: string,
  type: string,
  payloadJson?: string,
): Promise<void> {
  const payload = payloadJson ? (JSON.parse(payloadJson) as Record<string, unknown>) : undefined
  const result = await ctx.api.previewMessage(ctx.world, ctx.branch, nodeIdOrSlug, {
    type,
    payload,
    meta: { at: new Date().toISOString() },
  })
  console.log('Preview (not persisted):')
  console.log(JSON.stringify(result.previewRevision, null, 2))
  if (result.logMessages.length > 0) {
    console.log('\nLog messages:')
    for (const m of result.logMessages) {
      console.log(`  [${m.level}] ${m.message}`)
    }
  }
}
