import * as readline from 'readline'
import type { ShellContext } from './context.js'
import { worldShow, worldHistory, worldDiff } from './commands/world.js'
import { branchList, branchFork, branchSwitch } from './commands/branch.js'
import { revisionSquash } from './commands/revision.js'
import { nodeList, nodeShow, nodeCreate, nodeInspect } from './commands/node.js'
import { edgeList, edgeCreate, edgeRemove } from './commands/edge.js'
import { messageSend, messagePreview } from './commands/message.js'
import { opApply } from './commands/op.js'
import { pkgList, pkgLoad, traitInspect } from './commands/pkg.js'
import { runtimeListeners } from './commands/runtime.js'

export async function startRepl(ctx: ShellContext): Promise<void> {
  const isTTY = process.stdin.isTTY === true
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `ontos(${ctx.world}/${ctx.branch})> `,
    terminal: isTTY,
  })

  console.log(`Ontos REPL — world: ${ctx.world}, branch: ${ctx.branch}`)
  console.log('Type "help" for available commands, "exit" to quit.\n')

  rl.prompt()

  // Queue commands to ensure sequential async processing (handles piped input correctly)
  const queue: string[] = []
  let running = false

  async function processQueue(): Promise<void> {
    if (running) return
    running = true
    while (queue.length > 0) {
      const line = queue.shift()!
      const trimmed = line.trim()
      if (trimmed) {
        try {
          await dispatch(trimmed, ctx)
        } catch (err) {
          console.error('Error:', err instanceof Error ? err.message : String(err))
        }
      }
      if (isTTY) rl.prompt()
    }
    running = false
  }

  rl.on('line', (line: string) => {
    queue.push(line)
    void processQueue()
  })

  await new Promise<void>((resolve) => {
    rl.on('close', async () => {
      // Drain the queue before resolving
      while (queue.length > 0 || running) {
        await new Promise((r) => setTimeout(r, 10))
      }
      resolve()
    })
  })
}

/** Run a single shell command string programmatically (used by `ontos run`). */
export async function runCommand(line: string, ctx: ShellContext): Promise<void> {
  await dispatch(line.trim(), ctx)
}

async function dispatch(input: string, ctx: ShellContext): Promise<void> {
  const [cmd, sub, ...rest] = tokenize(input)

  switch (cmd) {
    case 'exit':
    case 'quit':
      process.exit(0)

    case 'help':
      printHelp()
      break

    case 'world':
      if (sub === 'show' || !sub) await worldShow(ctx)
      else if (sub === 'history') await worldHistory(ctx)
      else if (sub === 'diff') {
        if (!rest[0] || !rest[1]) { console.error('Usage: world diff <revA> <revB>'); break }
        await worldDiff(ctx, rest[0], rest[1])
      } else unknown(input)
      break

    case 'branch':
      if (sub === 'list' || !sub) await branchList(ctx)
      else if (sub === 'fork') {
        if (!rest[0] || !rest[1]) { console.error('Usage: branch fork <from> <name>'); break }
        await branchFork(ctx, rest[0], rest[1])
      } else if (sub === 'switch') {
        if (!rest[0]) { console.error('Usage: branch switch <name>'); break }
        await branchSwitch(ctx, rest[0])
      } else unknown(input)
      break

    case 'revision':
      if (sub === 'squash') {
        if (!rest[0] || !rest[1]) { console.error('Usage: revision squash <fromRev> <toRev>'); break }
        await revisionSquash(ctx, rest[0], rest[1])
      } else unknown(input)
      break

    case 'node':
      if (sub === 'list' || !sub) await nodeList(ctx)
      else if (sub === 'show') {
        if (!rest[0]) { console.error('Usage: node show <id|slug>'); break }
        await nodeShow(ctx, rest[0])
      } else if (sub === 'create') {
        const opts = parseFlags(rest)
        await nodeCreate(ctx, { name: opts['name'], kind: opts['kind'], slug: opts['slug'] })
      } else if (sub === 'inspect') {
        if (!rest[0]) { console.error('Usage: node inspect <id|slug>'); break }
        await nodeInspect(ctx, rest[0])
      } else unknown(input)
      break

    case 'edge':
      if (sub === 'list' || !sub) await edgeList(ctx)
      else if (sub === 'create') {
        if (!rest[0] || !rest[1] || !rest[2]) {
          console.error('Usage: edge create <type> <from> <to>')
          break
        }
        await edgeCreate(ctx, rest[0], rest[1], rest[2])
      } else if (sub === 'remove') {
        if (!rest[0]) { console.error('Usage: edge remove <edgeId>'); break }
        await edgeRemove(ctx, rest[0])
      } else unknown(input)
      break

    case 'message':
    case 'msg':
      if (sub === 'send') {
        if (!rest[0] || !rest[1]) { console.error('Usage: message send <node> <type> [payload]'); break }
        const flags = parseFlags(rest.slice(2))
        await messageSend(ctx, rest[0], rest[1], flags['payload'])
      } else if (sub === 'preview') {
        if (!rest[0] || !rest[1]) { console.error('Usage: message preview <node> <type> [payload]'); break }
        const flags = parseFlags(rest.slice(2))
        await messagePreview(ctx, rest[0], rest[1], flags['payload'])
      } else unknown(input)
      break

    case 'op':
      if (sub === 'apply') {
        if (!rest[0]) { console.error('Usage: op apply <type> [payload]'); break }
        const flags = parseFlags(rest.slice(1))
        await opApply(ctx, rest[0], flags['payload'])
      } else unknown(input)
      break

    case 'pkg':
    case 'package':
      if (sub === 'list' || !sub) await pkgList(ctx)
      else if (sub === 'load') {
        if (!rest[0]) { console.error('Usage: pkg load <path>'); break }
        await pkgLoad(ctx, rest[0])
      } else unknown(input)
      break

    case 'trait':
      if (sub === 'inspect') {
        if (!rest[0]) { console.error('Usage: trait inspect <uri>'); break }
        await traitInspect(ctx, rest[0])
      } else unknown(input)
      break

    case 'runtime':
      if (sub === 'listeners' || !sub) runtimeListeners(ctx)
      else unknown(input)
      break

    default:
      unknown(input)
  }
}

function unknown(input: string): void {
  console.error(`Unknown command: "${input}". Type "help" for available commands.`)
}

function printHelp(): void {
  console.log(`
Available commands:

  world show                       — current world/branch/revision
  world history                    — log entries for this branch
  world diff <revA> <revB>         — diff two revisions

  branch list                      — list branches
  branch fork <from> <name>        — fork a branch from a revision
  branch switch <name>             — switch active branch

  revision squash <from> <to>      — squash revision range into one entry

  node list                        — list all nodes
  node show <id|slug>              — show node details
  node create --name <n> [--kind <k>] [--slug <s>]
  node inspect <id|slug>           — full record + log history

  edge list                        — list all edges
  edge create <type> <from> <to>   — create an edge
  edge remove <edgeId>             — remove an edge

  message send <node> <type> [--payload <json>]
  message preview <node> <type> [--payload <json>]

  op apply <type> [--payload <json>]

  pkg list                         — list loaded traits
  pkg load <path>                  — load a package

  trait inspect <uri>              — inspect a trait definition

  runtime listeners                — list active TCP/HTTP listeners

  help                             — show this help
  exit                             — quit
`)
}

/** Split input into tokens, respecting quoted strings. */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false }
      else { current += ch }
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quoteChar = ch
    } else if (ch === ' ') {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

/** Parse --flag value pairs from a token list. */
function parseFlags(tokens: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t && t.startsWith('--')) {
      const key = t.slice(2)
      const next = tokens[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = 'true'
      }
    }
  }
  return flags
}
