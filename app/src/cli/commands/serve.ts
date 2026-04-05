import { Command } from 'commander'
import { makeShellContext } from '../../shell/context.js'
import { createApp, SseBroadcaster } from '../../server/index.js'

export const serveCommand = new Command('serve')
  .description('Start the HTTP API + web UI server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-w, --world <world>', 'World name', 'default')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-d, --data-dir <dir>', 'Data directory', '.ontos-data')
  .action(async (opts: { port: string; world: string; branch: string; dataDir: string }) => {
    const port = parseInt(opts.port, 10)
    const ctx = await makeShellContext(opts.world, opts.branch, opts.dataDir)
    const sse = new SseBroadcaster()
    const app = createApp(ctx.api, ctx, sse)

    app.listen(port, () => {
      console.log(`Ontos server running on http://localhost:${port}`)
      console.log(`World: ${opts.world}  Branch: ${opts.branch}`)
      console.log(`SSE: GET http://localhost:${port}/events`)
    })

    process.on('SIGINT', async () => {
      await ctx.close()
      process.exit(0)
    })
  })
