import type { Router } from 'express'
import type { OntosShellApi } from '@ontos/kernel'
import type { SseBroadcaster } from '../sse.js'

export function registerNodeRoutes(router: Router, api: OntosShellApi, sse: SseBroadcaster): void {
  // GET /worlds/:world/branches/:branch/nodes
  router.get('/worlds/:world/branches/:branch/nodes', async (req, res) => {
    const { world, branch } = req.params
    const nodes = await api.listNodes(world, branch)
    res.json(nodes)
  })

  // GET /worlds/:world/branches/:branch/nodes/:id
  router.get('/worlds/:world/branches/:branch/nodes/:id', async (req, res) => {
    const { world, branch, id } = req.params
    const node = await api.getNode(world, branch, id)
    if (!node) { res.status(404).json({ error: `Node "${id}" not found` }); return }
    res.json(node)
  })

  // POST /worlds/:world/branches/:branch/nodes/:id/message
  router.post('/worlds/:world/branches/:branch/nodes/:id/message', async (req, res) => {
    const { world, branch, id } = req.params
    const { type, payload } = req.body as { type?: string; payload?: Record<string, unknown> }
    if (!type) { res.status(400).json({ error: 'Missing message type' }); return }

    const result = await api.sendMessage(world, branch, id, { type, payload })
    sse.broadcast('revision', result.newRevisionId)
    res.json({ revisionId: result.newRevisionId, revision: result.revision })
  })

  // POST /worlds/:world/branches/:branch/nodes/:id/message/preview
  router.post('/worlds/:world/branches/:branch/nodes/:id/message/preview', async (req, res) => {
    const { world, branch, id } = req.params
    const { type, payload } = req.body as { type?: string; payload?: Record<string, unknown> }
    if (!type) { res.status(400).json({ error: 'Missing message type' }); return }

    const result = await api.previewMessage(world, branch, id, { type, payload })
    res.json({ revision: result.previewRevision })
  })
}
