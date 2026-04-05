import type { Effect, WorldRevision, Message, NodeId } from '../types.js'
import type { TraitRegistry } from '../trait/registry.js'
import type { IRuntimeHost } from './types.js'
import { applyOp } from '../node/ops.js'
import { dispatchMessage } from '../message/dispatch.js'

const MAX_CASCADE_DEPTH = 10

export class CascadeDepthError extends Error {
  constructor() {
    super(`Effect cascade exceeded max depth of ${MAX_CASCADE_DEPTH}`)
    this.name = 'CascadeDepthError'
  }
}

type QueueEntry = { nodeId: NodeId; message: Message; depth: number }

export type InterpretResult = {
  revision: WorldRevision
  logMessages: Array<{ level: 'info' | 'warn' | 'error'; message: string }>
}

/**
 * Process a list of effects against a working revision.
 *
 * - `apply_op` effects are applied immediately via applyOp
 * - `emit_message` effects are enqueued as follow-up dispatches (BFS, depth-limited)
 * - `log` effects are collected and returned for the caller to record
 * - `open_listener` / `close_listener` / `schedule_message` delegate to IRuntimeHost
 */
export async function interpretEffects(
  initialEffects: Effect[],
  revision: WorldRevision,
  registry: TraitRegistry,
  host: IRuntimeHost,
): Promise<InterpretResult> {
  let current = revision
  const logMessages: InterpretResult['logMessages'] = []

  // Seed the BFS queue with effects from the initial dispatch
  const queue: QueueEntry[] = []

  // Process one batch of effects, returning any emit_message entries to enqueue
  async function processEffects(effects: Effect[], depth: number): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'apply_op':
          current = applyOp(effect.op, current)
          break

        case 'emit_message':
          queue.push({ nodeId: effect.targetNodeId, message: effect.message, depth })
          break

        case 'log':
          logMessages.push({ level: effect.level, message: effect.message })
          break

        case 'open_listener':
          await host.openListener({
            protocol: effect.protocol,
            port: effect.port,
            nodeId: effect.nodeId,
          })
          break

        case 'close_listener':
          await host.closeListener(effect.listenerId)
          break

        case 'schedule_message':
          await host.scheduleMessage({
            at: effect.at,
            targetNodeId: effect.targetNodeId,
            message: effect.message,
          })
          break

        default: {
          const _exhaustive: never = effect
          throw new Error(`Unhandled effect type: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
  }

  // Process the initial effects
  await processEffects(initialEffects, 1)

  // BFS over emitted messages
  while (queue.length > 0) {
    const entry = queue.shift()!
    if (entry.depth > MAX_CASCADE_DEPTH) throw new CascadeDepthError()

    const result = await dispatchMessage(entry.nodeId, entry.message, current, registry)
    await processEffects(result.effects, entry.depth + 1)
  }

  return { revision: current, logMessages }
}
