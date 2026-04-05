import type { Router } from 'express'
import type { ShellContext } from '../../shell/context.js'
import { runCommand } from '../../shell/repl.js'

export function registerShellRoutes(router: Router, ctx: ShellContext): void {
  // POST /shell/exec — execute a shell command and return captured output
  router.post('/shell/exec', async (req, res) => {
    const { command } = req.body as { command?: string }
    if (!command) { res.status(400).json({ error: 'Missing command' }); return }

    const stdoutLines: string[] = []
    const stderrLines: string[] = []

    const origLog = console.log
    const origError = console.error

    console.log = (...args: unknown[]) => stdoutLines.push(args.map(String).join(' '))
    console.error = (...args: unknown[]) => stderrLines.push(args.map(String).join(' '))

    try {
      await runCommand(command, ctx)
    } catch (err) {
      stderrLines.push(err instanceof Error ? err.message : String(err))
    } finally {
      console.log = origLog
      console.error = origError
    }

    res.json({
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
    })
  })
}
