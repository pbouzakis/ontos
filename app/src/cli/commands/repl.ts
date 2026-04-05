import { Command } from 'commander'
import { makeShellContext } from '../../shell/context.js'
import { startRepl } from '../../shell/repl.js'

export const replCommand = new Command('repl')
  .description('Start an interactive Ontos shell (local kernel)')
  .option('-w, --world <world>', 'World name', 'default')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-d, --data-dir <dir>', 'Data directory', '.ontos-data')
  .action(async (opts: { world: string; branch: string; dataDir: string }) => {
    const ctx = await makeShellContext(opts.world, opts.branch, opts.dataDir)
    try {
      await startRepl(ctx)
    } finally {
      await ctx.close()
    }
  })
