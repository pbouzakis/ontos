import type { Response } from 'express'

/**
 * Manages SSE (Server-Sent Events) clients. Pass an instance into routes
 * so they can broadcast revision events after mutations.
 */
export class SseBroadcaster {
  private clients = new Set<Response>()

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    this.clients.add(res)
    res.on('close', () => this.clients.delete(res))
  }

  broadcast(event: string, data: string): void {
    const payload = `event: ${event}\ndata: ${data}\n\n`
    for (const res of this.clients) {
      res.write(payload)
    }
  }

  get clientCount(): number {
    return this.clients.size
  }
}
