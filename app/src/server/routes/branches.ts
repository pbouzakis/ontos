import type { Router } from 'express'
import type { OntosShellApi } from '@ontos/kernel'

export function registerBranchRoutes(router: Router, api: OntosShellApi): void {
  // GET /worlds/:world/branches
  router.get('/worlds/:world/branches', async (req, res) => {
    const { world } = req.params
    const branches = await api.listBranches(world)
    res.json(branches)
  })
}
