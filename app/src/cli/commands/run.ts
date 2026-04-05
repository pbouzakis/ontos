import { Command } from 'commander'
import * as path from 'path'
import { makeShellContext, type ShellContext } from '../../shell/context.js'

export const runCommand = new Command('run')
  .description('Run a script against the Ontos runtime')
  .argument('<script>', 'Path to the script file to run')
  .option('-w, --world <world>', 'World name', 'default')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-d, --data-dir <dir>', 'Data directory', '.ontos-data')
  .action(async (scriptArg: string, opts: { world: string; branch: string; dataDir: string }) => {
    const ctx = await makeShellContext(opts.world, opts.branch, opts.dataDir)
    const scriptPath = path.resolve(process.cwd(), scriptArg)
    try {
      const mod = await import(scriptPath) as { default?: (ctx: ShellContext) => Promise<void> }
      if (typeof mod.default !== 'function') {
        console.error(`Script must export a default function: ${scriptArg}`)
        process.exit(1)
      }
      await mod.default(ctx)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    } finally {
      await ctx.close()
    }
  })
