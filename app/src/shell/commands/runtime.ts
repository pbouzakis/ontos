import type { ShellContext } from '../context.js'

export function runtimeListeners(ctx: ShellContext): void {
  const listeners = ctx.host.listListeners()
  if (listeners.length === 0) {
    console.log('No active listeners.')
    return
  }
  for (const l of listeners) {
    console.log(
      `  ${l.listenerId.slice(0, 8)}  ${l.protocol}://127.0.0.1:${l.port}  node:${l.nodeId.slice(0, 8)}`,
    )
  }
}
