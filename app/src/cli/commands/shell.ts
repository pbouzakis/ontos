import { Command } from 'commander'

export const shellCommand = new Command('shell')
  .description('Attach to a running Ontos server shell (Phase 6)')
  .option('--url <url>', 'Server URL', 'http://localhost:3000')
  .action(() => {
    console.error('ontos shell: not yet implemented (Phase 6 — requires HTTP server)')
    process.exit(1)
  })
