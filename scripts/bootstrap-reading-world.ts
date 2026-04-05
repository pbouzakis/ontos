/**
 * Bootstrap reading world script.
 *
 * Usage:
 *   ontos run scripts/bootstrap-reading-world.ts --world reading --branch main
 *
 * After running:
 *   node list          → Book, ReadingList, DerivedValue nodes
 *   node show paradise-lost  → reading.lifecycle.status: "want_to_read"
 *   message send paradise-lost mark_active  → transitions to "active"
 */
import { randomUUID } from 'crypto'
import * as path from 'path'
import type { ShellContext } from '../app/src/shell/context.js'

export default async function bootstrap(ctx: ShellContext): Promise<void> {
  const { api, world, branch } = ctx
  const now = new Date().toISOString()

  // ── 1. Load the reading package ───────────────────────────────────────────
  const pkgPath = path.resolve(__dirname, '../packages/src/reading/index.js')
  const loaded = await api.loadPackage(pkgPath)
  console.log('Loaded traits:', loaded)

  // ── 2. Create Book node (Paradise Lost) ───────────────────────────────────
  const bookId = randomUUID()
  await api.applyOp(world, branch, {
    type: 'create_node',
    node: {
      id: bookId,
      slug: 'paradise-lost',
      name: 'Paradise Lost',
      kinds: ['book'],
      state: { 'reading.lifecycle': { status: 'want_to_read' } },
      traits: [],
      createdAt: now,
      updatedAt: now,
    },
  })

  // Express the book lifecycle trait on the book node
  await api.applyOp(world, branch, {
    type: 'express_trait',
    nodeId: bookId,
    trait: 'pkg://reading/book@v1#reading.lifecycle',
  })
  console.log('Created Book node: paradise-lost')

  // ── 3. Create ReadingList node ────────────────────────────────────────────
  const listId = randomUUID()
  await api.applyOp(world, branch, {
    type: 'create_node',
    node: {
      id: listId,
      slug: 'my-reading-list',
      name: 'My Reading List',
      kinds: ['reading-list'],
      state: {},
      traits: [],
      createdAt: now,
      updatedAt: now,
    },
  })

  await api.applyOp(world, branch, {
    type: 'express_trait',
    nodeId: listId,
    trait: 'pkg://reading/list@v1#reading.list',
  })
  console.log('Created ReadingList node: my-reading-list')

  // ── 4. Add book to reading list via message ───────────────────────────────
  await api.sendMessage(world, branch, 'my-reading-list', {
    type: 'add_book',
    payload: { bookNodeId: bookId },
  })
  console.log('Added paradise-lost to my-reading-list')

  // ── 5. Create DerivedValue node (latest active book) ──────────────────────
  const derivedId = randomUUID()
  await api.applyOp(world, branch, {
    type: 'create_node',
    node: {
      id: derivedId,
      slug: 'latest-active-book',
      name: 'Latest Active Book',
      kinds: ['derived'],
      state: {},
      traits: [],
      createdAt: now,
      updatedAt: now,
    },
  })

  await api.applyOp(world, branch, {
    type: 'express_trait',
    nodeId: derivedId,
    trait: 'pkg://reading/query@v1#latestActiveBook',
  })
  console.log('Created DerivedValue node: latest-active-book')

  // ── 6. Initial recompute ──────────────────────────────────────────────────
  await api.sendMessage(world, branch, 'latest-active-book', { type: 'recompute' })
  console.log('Recomputed derived node')

  // ── 7. Summary ────────────────────────────────────────────────────────────
  const nodes = await api.listNodes(world, branch)
  console.log(`\nBootstrap complete. ${nodes.length} nodes in world "${world}/${branch}":`)
  for (const n of nodes) {
    console.log(`  ${n.slug.padEnd(24)} [${n.kinds.join(', ')}]  traits: ${n.traits.length}`)
  }
}

// Allow running directly with tsx
const __dirname = new URL('.', import.meta.url).pathname
