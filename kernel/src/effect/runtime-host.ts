import * as net from 'net'
import type { IRuntimeHost } from './types.js'
import type { NodeId } from '../types.js'

export type ListenerEntry = {
  listenerId: string
  protocol: 'http' | 'tcp'
  port: number
  nodeId: NodeId
  server: net.Server
}

/**
 * Real runtime host — binds TCP ports using Node's `net` module.
 * `listenerId` is the `nodeId` that requested the listener (one listener per node).
 */
export class RuntimeHost implements IRuntimeHost {
  private readonly listeners = new Map<string, ListenerEntry>()

  async openListener(opts: {
    protocol: 'http' | 'tcp'
    port: number
    nodeId: NodeId
  }): Promise<{ listenerId: string }> {
    const listenerId = opts.nodeId

    if (this.listeners.has(listenerId)) {
      throw new Error(
        `Listener already open for node "${opts.nodeId}" (port ${this.listeners.get(listenerId)!.port})`,
      )
    }

    const server = net.createServer()

    await new Promise<void>((resolve, reject) => {
      server.once('error', (err) => {
        reject(new Error(`Failed to open listener on port ${opts.port}: ${err.message}`))
      })
      server.listen(opts.port, '127.0.0.1', () => resolve())
    })

    this.listeners.set(listenerId, {
      listenerId,
      protocol: opts.protocol,
      port: opts.port,
      nodeId: opts.nodeId,
      server,
    })

    return { listenerId }
  }

  async closeListener(listenerId: string): Promise<void> {
    const entry = this.listeners.get(listenerId)
    if (!entry) {
      throw new Error(`No listener found with id "${listenerId}"`)
    }
    await new Promise<void>((resolve, reject) => {
      entry.server.close((err) => (err ? reject(err) : resolve()))
    })
    this.listeners.delete(listenerId)
  }

  async scheduleMessage(_opts: {
    at: string
    targetNodeId: NodeId
    message: { type: string; payload?: Record<string, unknown> }
  }): Promise<void> {
    // Phase 4 scope: scheduling not yet implemented
    throw new Error('scheduleMessage not yet implemented (Phase 4+)')
  }

  /** Returns a snapshot of active listeners for the shell `runtime listeners` command. */
  listListeners(): ReadonlyArray<Omit<ListenerEntry, 'server'>> {
    return Array.from(this.listeners.values()).map(({ listenerId, protocol, port, nodeId }) => ({
      listenerId,
      protocol,
      port,
      nodeId,
    }))
  }

  /** Close all active listeners — call on process exit. */
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.listeners.keys()).map((id) => this.closeListener(id)),
    )
  }
}
