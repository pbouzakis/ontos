import type { Router } from 'express'
import type { OntosShellApi } from '@ontos/kernel'
import type { SseBroadcaster } from '../sse.js'

export function registerRevisionRoutes(router: Router, api: OntosShellApi, sse: SseBroadcaster): void {
  // GET /worlds/:world/branches/:branch/revisions — returns log entries as revision list
  router.get('/worlds/:world/branches/:branch/revisions', async (req, res) => {
    const { world, branch } = req.params
    const entries = await api.getLog(world, branch)
    res.json(entries.map((e) => ({
      id: e.revisionId,
      parentId: e.parentRevisionId,
      timestamp: e.timestamp,
      cause: e.cause,
    })))
  })

  // POST /worlds/:world/branches/:branch/ops — apply a developer op
  router.post('/worlds/:world/branches/:branch/ops', async (req, res) => {
    const { world, branch } = req.params
    const op = req.body as Record<string, unknown>
    if (!op || !op['type']) { res.status(400).json({ error: 'Missing op.type' }); return }

    const result = await api.applyOp(world, branch, op as Parameters<typeof api.applyOp>[2])
    sse.broadcast('revision', result.newRevisionId)
    res.json({ revisionId: result.newRevisionId, revision: result.revision })
  })
}
