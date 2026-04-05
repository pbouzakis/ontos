#!/usr/bin/env node
import { Command } from 'commander'
import { replCommand } from './commands/repl.js'
import { shellCommand } from './commands/shell.js'
import { serveCommand } from './commands/serve.js'
import { runCommand } from './commands/run.js'

const program = new Command()

program
  .name('ontos')
  .description('Ontos runtime — live, persistent graph of computational beings')
  .version('0.0.1')

program.addCommand(replCommand)
program.addCommand(shellCommand)
program.addCommand(serveCommand)
program.addCommand(runCommand)

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
