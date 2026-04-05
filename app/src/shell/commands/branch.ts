import type { ShellContext } from '../context.js'

export async function branchList(ctx: ShellContext): Promise<void> {
  const branches = await ctx.api.listBranches(ctx.world)
  if (branches.length === 0) {
    console.log('No branches found.')
    return
  }
  for (const b of branches) {
    const current = b.name === ctx.branch ? ' ← current' : ''
    const forked = b.forkedFromRevisionId ? `  (forked from ${b.forkedFromRevisionId.slice(0, 8)})` : ''
    console.log(`  ${b.name === ctx.branch ? '*' : ' '} ${b.name}  head:${b.headRevisionId.slice(0, 8)}${forked}${current}`)
  }
}

export async function branchFork(ctx: ShellContext, fromRevId: string, name: string): Promise<void> {
  try {
    const branch = await ctx.api.forkBranch(ctx.world, fromRevId, name)
    console.log(`Forked branch "${branch.name}" from revision ${fromRevId.slice(0, 8)}`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
  }
}

export async function branchSwitch(ctx: ShellContext, name: string): Promise<void> {
  const branches = await ctx.api.listBranches(ctx.world)
  const exists = branches.some((b) => b.name === name)
  if (!exists) {
    throw new Error(`Branch "${name}" does not exist in world "${ctx.world}"`)
  }
  ctx.branch = name
  console.log(`Switched to branch "${name}"`)
}
