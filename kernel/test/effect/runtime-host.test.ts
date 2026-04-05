import { describe, it, expect, afterEach } from 'vitest'
import { RuntimeHost } from '../../src/effect/runtime-host.js'
import * as net from 'net'

/** Find a free port by binding to 0 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address() as net.AddressInfo
      s.close(() => resolve(addr.port))
    })
    s.on('error', reject)
  })
}

describe('RuntimeHost', () => {
  let host: RuntimeHost

  afterEach(async () => {
    await host.closeAll()
  })

  it('opens a listener on a free port', async () => {
    host = new RuntimeHost()
    const port = await getFreePort()
    const result = await host.openListener({ protocol: 'tcp', port, nodeId: 'node-1' })
    expect(result.listenerId).toBe('node-1')
    expect(host.listListeners()).toHaveLength(1)
    expect(host.listListeners()[0]?.port).toBe(port)
  })

  it('listListeners returns correct metadata', async () => {
    host = new RuntimeHost()
    const port = await getFreePort()
    await host.openListener({ protocol: 'http', port, nodeId: 'node-2' })
    const [entry] = host.listListeners()
    expect(entry?.listenerId).toBe('node-2')
    expect(entry?.protocol).toBe('http')
    expect(entry?.nodeId).toBe('node-2')
  })

  it('throws if the same node opens a second listener', async () => {
    host = new RuntimeHost()
    const port1 = await getFreePort()
    const port2 = await getFreePort()
    await host.openListener({ protocol: 'tcp', port: port1, nodeId: 'node-3' })
    await expect(
      host.openListener({ protocol: 'tcp', port: port2, nodeId: 'node-3' }),
    ).rejects.toThrow(/already open/)
  })

  it('throws if the port is already bound externally', async () => {
    host = new RuntimeHost()
    const port = await getFreePort()
    // Bind the port ourselves
    const blocker = net.createServer()
    await new Promise<void>((r) => blocker.listen(port, '127.0.0.1', r))
    try {
      await expect(
        host.openListener({ protocol: 'tcp', port, nodeId: 'node-4' }),
      ).rejects.toThrow(/Failed to open listener/)
    } finally {
      await new Promise<void>((r) => blocker.close(() => r()))
    }
  })

  it('closes a listener and removes it from the registry', async () => {
    host = new RuntimeHost()
    const port = await getFreePort()
    await host.openListener({ protocol: 'tcp', port, nodeId: 'node-5' })
    expect(host.listListeners()).toHaveLength(1)
    await host.closeListener('node-5')
    expect(host.listListeners()).toHaveLength(0)
  })

  it('throws when closing a non-existent listener', async () => {
    host = new RuntimeHost()
    await expect(host.closeListener('does-not-exist')).rejects.toThrow(/No listener found/)
  })

  it('closeAll closes every open listener', async () => {
    host = new RuntimeHost()
    const p1 = await getFreePort()
    const p2 = await getFreePort()
    await host.openListener({ protocol: 'tcp', port: p1, nodeId: 'node-6' })
    await host.openListener({ protocol: 'tcp', port: p2, nodeId: 'node-7' })
    expect(host.listListeners()).toHaveLength(2)
    await host.closeAll()
    expect(host.listListeners()).toHaveLength(0)
  })
})
