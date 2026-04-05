import type { NodeId } from '../types.js'

/**
 * Runtime host interface — delegates side-effecting operations (listeners,
 * schedulers) outside the pure kernel. The app layer implements this;
 * tests use stubs.
 */
export interface IRuntimeHost {
  openListener(opts: {
    protocol: 'http' | 'tcp'
    port: number
    nodeId: NodeId
  }): Promise<{ listenerId: string }>

  closeListener(listenerId: string): Promise<void>

  scheduleMessage(opts: {
    at: string
    targetNodeId: NodeId
    message: { type: string; payload?: Record<string, unknown> }
  }): Promise<void>
}
