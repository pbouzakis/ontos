import type {
  NodeId,
  Message,
  WorldRevision,
  Effect,
  TraitContext,
  MessageHandler,
} from '../types.js'
import type { TraitRegistry } from '../trait/registry.js'

export class NoHandlerError extends Error {
  constructor(messageType: string, nodeId: NodeId) {
    super(`No handler for message type "${messageType}" on node "${nodeId}"`)
    this.name = 'NoHandlerError'
  }
}

export class HandlerConflictError extends Error {
  constructor(messageType: string, traitA: string, traitB: string) {
    super(
      `Message type "${messageType}" is handled by both "${traitA}" and "${traitB}"`,
    )
    this.name = 'HandlerConflictError'
  }
}

export type DispatchResult = {
  effects: Effect[]
}

/**
 * Resolves the node's expressed traits, finds the single handler for the
 * given message type, calls it with a TraitContext, and returns the effects.
 *
 * Throws NoHandlerError if no trait handles the message type.
 * Throws HandlerConflictError if two traits both handle the same message type.
 */
export async function dispatchMessage(
  nodeId: NodeId,
  message: Message,
  revision: WorldRevision,
  registry: TraitRegistry,
): Promise<DispatchResult> {
  const node = revision.nodes[nodeId]
  if (!node) throw new Error(`Node not found: ${nodeId}`)

  let handlerTraitUri: string | null = null
  let handler: MessageHandler | null = null

  for (const traitUri of node.traits) {
    const def = registry.get(traitUri)
    const candidate = def.handles[message.type]
    if (candidate) {
      if (handlerTraitUri !== null) {
        throw new HandlerConflictError(message.type, handlerTraitUri, traitUri)
      }
      handlerTraitUri = traitUri
      handler = candidate
    }
  }

  if (!handler) {
    throw new NoHandlerError(message.type, nodeId)
  }

  const ctx: TraitContext = {
    node,
    revision,
    now: new Date().toISOString(),
  }

  const result = await handler(ctx, message)
  return { effects: result?.effects ?? [] }
}
