import type { ShellContext } from '../context.js'
import type { WorldOp } from '@ontos/kernel'

export async function opApply(
  ctx: ShellContext,
  type: string,
  payloadJson?: string,
): Promise<void> {
  const payload = payloadJson ? (JSON.parse(payloadJson) as Record<string, unknown>) : {}
  const op = { type, ...payload } as WorldOp
  const result = await ctx.api.applyOp(ctx.world, ctx.branch, op)
  console.log(`Op applied. New revision: ${result.newRevisionId.slice(0, 8)}`)
}
