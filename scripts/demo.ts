/**
 * Ontos kernel demo — run with:
 *   pnpm tsx scripts/demo.ts
 */
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { JsonFileStore } from '../kernel/src/store/json-file-store'
import { RevisionStore } from '../kernel/src/world/revision-store'

const dir = mkdtempSync(join(tmpdir(), 'ontos-demo-'))
const store = new RevisionStore(new JsonFileStore(dir))

async function main() {
  console.log('─── Ontos kernel demo ───\n')

  // 1. Create a world
  console.log('1. Creating world "reading"...')
  const world = await store.createWorld('reading')
  const rev0 = await store.getCurrentRevision('reading', 'main')
  if (!rev0) throw new Error('no revision')

  console.log(`   Baseline revision: ${world.baseline.id}`)
  console.log(`   Kernel nodes: ${Object.values(rev0.nodes).map((n) => n.slug).join(', ')}\n`)

  // 2. Create a Book node
  console.log('2. Creating node: Paradise Lost (Book)...')
  const bookId = randomUUID()
  const now = new Date().toISOString()

  await store.saveRevision('reading', 'main', {
    revisionId: randomUUID(),
    cause: { type: 'operation', operation: { type: 'create_node', node: { id: bookId, slug: 'paradise-lost', name: 'Paradise Lost', kinds: ['Book'], url: '/worlds/reading/nodes/paradise-lost', state: {}, traits: [], createdAt: now, updatedAt: now } } },
    effects: [],
    appliedOps: [{ type: 'create_node', node: { id: bookId, slug: 'paradise-lost', name: 'Paradise Lost', kinds: ['Book'], url: '/worlds/reading/nodes/paradise-lost', state: {}, traits: [], createdAt: now, updatedAt: now } }],
  })

  const rev1 = await store.getCurrentRevision('reading', 'main')
  const book = rev1?.nodes[bookId]
  console.log(`   Node: ${book?.name} (${book?.kinds.join(', ')})`)
  console.log(`   URL:  ${book?.url}\n`)

  // 3. Express trait and set state — two ops, one log entry
  console.log('3. Expressing reading.lifecycle trait and marking active...')
  const traitUri = 'pkg://reading/book@v1#reading.lifecycle'

  await store.saveRevision('reading', 'main', {
    revisionId: randomUUID(),
    cause: { type: 'runtime', description: 'mark_active message' },
    effects: [],
    appliedOps: [
      { type: 'express_trait', nodeId: bookId, trait: traitUri },
      { type: 'set_node_state', nodeId: bookId, patch: { 'reading.lifecycle': { status: 'active', startedAt: now } } },
    ],
  })

  const rev2 = await store.getCurrentRevision('reading', 'main')
  const bookWithTrait = rev2?.nodes[bookId]
  console.log(`   Traits: ${bookWithTrait?.traits.join(', ')}`)
  console.log(`   State:  ${JSON.stringify(bookWithTrait?.state['reading.lifecycle'])}\n`)

  // 4. Show that only ops are stored — no duplicate snapshots
  const savedWorld = await store.getWorld('reading')
  console.log('4. Storage model:')
  console.log(`   Baseline nodes: ${Object.keys(savedWorld!.baseline.nodes).length} (kernel nodes only)`)
  console.log(`   Log entries:    ${savedWorld!.log.length}`)
  console.log(`   Total ops stored: ${savedWorld!.log.reduce((n, e) => n + e.appliedOps.length, 0)}`)
  console.log(`   (No duplicate snapshots — current state is replayed from baseline + ops)\n`)

  // 5. Revision log
  console.log('5. Revision log:')
  const log = await store.getLogEntries('reading', 'main')
  for (const entry of log) {
    const desc = entry.cause.type === 'runtime' ? entry.cause.description
      : entry.cause.type === 'operation' ? entry.cause.operation.type
      : entry.cause.message.type
    console.log(`   [${entry.timestamp}] ${entry.cause.type}: ${desc} (${entry.appliedOps.length} ops)`)
  }

  console.log('\n─── Data stored at:', dir, '───')
}

main().catch(console.error)
