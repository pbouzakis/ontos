import type { ShellContext } from '../context.js'

export async function revisionSquash(ctx: ShellContext, fromRevId: string, toRevId: string): Promise<void> {
  try {
    await ctx.api.squashRevisions(ctx.world, ctx.branch, fromRevId, toRevId)
    console.log(`Squashed revisions ${fromRevId.slice(0, 8)}..${toRevId.slice(0, 8)} on branch "${ctx.branch}"`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
  }
}
