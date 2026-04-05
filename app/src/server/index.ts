import express from 'express'
import { join } from 'path'
import { existsSync } from 'fs'
import type { OntosShellApi } from '@ontos/kernel'
import type { ShellContext } from '../shell/context.js'
import { SseBroadcaster } from './sse.js'
import { registerNodeRoutes } from './routes/nodes.js'
import { registerBranchRoutes } from './routes/branches.js'
import { registerRevisionRoutes } from './routes/revisions.js'
import { registerShellRoutes } from './routes/shell.js'

export { SseBroadcaster }

export function createApp(api: OntosShellApi, ctx: ShellContext, sse: SseBroadcaster): express.Application {
  const app = express()
  app.use(express.json())

  // Config endpoint — tells the UI which world/branch this server is managing
  app.get('/config', (_req, res) => {
    res.json({ world: ctx.world, branch: ctx.branch })
  })

  // SSE endpoint
  app.get('/events', (req, res) => {
    sse.addClient(res)
  })

  // API routes
  registerNodeRoutes(app, api, sse)
  registerBranchRoutes(app, api)
  registerRevisionRoutes(app, api, sse)
  registerShellRoutes(app, ctx)

  // Serve built UI
  const uiDir = join(__dirname, '..', '..', 'dist', 'ui')
  if (existsSync(uiDir)) {
    app.use(express.static(uiDir))
    app.get('/', (_req, res) => {
      res.sendFile(join(uiDir, 'index.html'))
    })
  }

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.message)
    res.status(500).json({ error: err.message })
  })

  return app
}
