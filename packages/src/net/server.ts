import type { TraitDefinition } from '@ontos/kernel'

export const serverTrait: TraitDefinition = {
  uri: 'pkg://net/server@v1#server.lifecycle',
  description: 'Manages a TCP/HTTP server lifecycle — start and stop a listener port.',
  ownsState: {
    desiredState: { type: 'string', required: true, default: 'stopped' },
    protocol:     { type: 'string', required: true, default: 'tcp' },
    port:         { type: 'number', required: true },
    listenerId:   { type: 'string' },
  },
  defaultState: {
    desiredState: 'stopped',
    protocol: 'tcp',
  },
  handles: {
    start_server(ctx, msg) {
      const port = (msg.payload?.port as number | undefined)
        ?? (ctx.node.state['server.lifecycle']?.port as number | undefined)
      const protocol = (msg.payload?.protocol as 'http' | 'tcp' | undefined)
        ?? (ctx.node.state['server.lifecycle']?.protocol as 'http' | 'tcp' | undefined)
        ?? 'tcp'

      if (typeof port !== 'number') {
        throw new Error('start_server requires payload.port (number) or existing state.port')
      }

      return {
        effects: [
          {
            type: 'apply_op',
            op: {
              type: 'set_node_state',
              nodeId: ctx.node.id,
              patch: {
                'server.lifecycle': {
                  desiredState: 'running',
                  protocol,
                  port,
                  // listenerId = nodeId (RuntimeHost contract)
                  listenerId: ctx.node.id,
                },
              },
            },
          },
          {
            type: 'open_listener',
            protocol,
            port,
            nodeId: ctx.node.id,
          },
        ],
      }
    },

    stop_server(ctx) {
      const state = ctx.node.state['server.lifecycle'] as
        | { listenerId?: string }
        | undefined

      const listenerId = state?.listenerId ?? ctx.node.id

      return {
        effects: [
          {
            type: 'apply_op',
            op: {
              type: 'set_node_state',
              nodeId: ctx.node.id,
              patch: {
                'server.lifecycle': {
                  desiredState: 'stopped',
                  listenerId: null,
                },
              },
            },
          },
          {
            type: 'close_listener',
            listenerId,
          },
        ],
      }
    },
  },
}
