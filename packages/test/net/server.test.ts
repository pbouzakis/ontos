import { describe, it, expect } from 'vitest'
import { serverTrait } from '../../src/net/server.js'
import type { TraitContext } from '@ontos/kernel'

function makeCtx(state: Record<string, unknown> = {}): TraitContext {
  return {
    node: {
      id: 'node-server-1',
      slug: 'api-server',
      name: 'API Server',
      kinds: ['server'],
      url: '/worlds/test/nodes/api-server',
      state: { 'server.lifecycle': state },
      traits: [serverTrait.uri],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    revision: {
      id: 'r1',
      worldName: 'test',
      branchName: 'main',
      createdAt: '2024-01-01T00:00:00.000Z',
      nodes: {},
      edges: {},
    },
    now: '2024-06-01T10:00:00.000Z',
  }
}

describe('serverTrait (server.lifecycle)', () => {
  describe('start_server', () => {
    it('emits apply_op(set_node_state) + open_listener', () => {
      const ctx = makeCtx()
      const result = serverTrait.handles.start_server(ctx, {
        type: 'start_server',
        payload: { port: 3000 },
      })
      expect(result.effects).toHaveLength(2)

      const [applyEffect, openEffect] = result.effects!
      expect(applyEffect?.type).toBe('apply_op')
      expect(openEffect?.type).toBe('open_listener')
    })

    it('sets desiredState to running and records port + listenerId', () => {
      const ctx = makeCtx()
      const result = serverTrait.handles.start_server(ctx, {
        type: 'start_server',
        payload: { port: 4000, protocol: 'http' },
      })
      const applyEffect = result.effects![0]
      if (applyEffect?.type === 'apply_op' && applyEffect.op.type === 'set_node_state') {
        const patch = applyEffect.op.patch['server.lifecycle']
        expect(patch?.desiredState).toBe('running')
        expect(patch?.port).toBe(4000)
        expect(patch?.protocol).toBe('http')
        expect(patch?.listenerId).toBe(ctx.node.id)
      }
    })

    it('open_listener carries the correct port, protocol, nodeId', () => {
      const ctx = makeCtx()
      const result = serverTrait.handles.start_server(ctx, {
        type: 'start_server',
        payload: { port: 5000, protocol: 'tcp' },
      })
      const openEffect = result.effects![1]
      if (openEffect?.type === 'open_listener') {
        expect(openEffect.port).toBe(5000)
        expect(openEffect.protocol).toBe('tcp')
        expect(openEffect.nodeId).toBe(ctx.node.id)
      }
    })

    it('reads port from existing node state if not in payload', () => {
      const ctx = makeCtx({ port: 7070, desiredState: 'stopped', protocol: 'tcp' })
      const result = serverTrait.handles.start_server(ctx, { type: 'start_server' })
      const openEffect = result.effects![1]
      if (openEffect?.type === 'open_listener') {
        expect(openEffect.port).toBe(7070)
      }
    })

    it('throws if no port is available', () => {
      const ctx = makeCtx()
      expect(() =>
        serverTrait.handles.start_server(ctx, { type: 'start_server' }),
      ).toThrow(/port/)
    })
  })

  describe('stop_server', () => {
    it('emits apply_op(set_node_state) + close_listener', () => {
      const ctx = makeCtx({ listenerId: 'node-server-1', desiredState: 'running', port: 3000 })
      const result = serverTrait.handles.stop_server(ctx, { type: 'stop_server' })
      expect(result.effects).toHaveLength(2)

      const [applyEffect, closeEffect] = result.effects!
      expect(applyEffect?.type).toBe('apply_op')
      expect(closeEffect?.type).toBe('close_listener')
    })

    it('sets desiredState to stopped', () => {
      const ctx = makeCtx({ listenerId: 'node-server-1', desiredState: 'running', port: 3000 })
      const result = serverTrait.handles.stop_server(ctx, { type: 'stop_server' })
      const applyEffect = result.effects![0]
      if (applyEffect?.type === 'apply_op' && applyEffect.op.type === 'set_node_state') {
        expect(applyEffect.op.patch['server.lifecycle']?.desiredState).toBe('stopped')
      }
    })

    it('close_listener uses the stored listenerId', () => {
      const ctx = makeCtx({ listenerId: 'node-server-1', desiredState: 'running' })
      const result = serverTrait.handles.stop_server(ctx, { type: 'stop_server' })
      const closeEffect = result.effects![1]
      if (closeEffect?.type === 'close_listener') {
        expect(closeEffect.listenerId).toBe('node-server-1')
      }
    })

    it('falls back to nodeId as listenerId if state has none', () => {
      const ctx = makeCtx({ desiredState: 'running' })
      const result = serverTrait.handles.stop_server(ctx, { type: 'stop_server' })
      const closeEffect = result.effects![1]
      if (closeEffect?.type === 'close_listener') {
        expect(closeEffect.listenerId).toBe(ctx.node.id)
      }
    })
  })
})
