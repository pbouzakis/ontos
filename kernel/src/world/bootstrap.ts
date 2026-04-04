import { randomUUID } from 'crypto'
import type { NodeRecord, WorldName, BranchName } from '../types'

export function makeKernelNodes(worldName: WorldName, branchName: BranchName): NodeRecord[] {
  const now = new Date().toISOString()
  const base = (slug: string, name: string): NodeRecord => ({
    id: randomUUID(),
    slug,
    name,
    kinds: ['SystemNode'],
    url: `/worlds/${worldName}/nodes/${slug}`,
    state: {},
    traits: [],
    createdAt: now,
    updatedAt: now,
  })

  void branchName // branch is part of the URL in future; kept for symmetry
  return [
    base('world-root', 'World Root'),
    base('system.log', 'System Log'),
    base('system.registry', 'System Registry'),
  ]
}
