import * as path from 'path'
import {
  OntosShellApi,
  JsonFileStore,
  TraitRegistry,
  RuntimeHost,
  type WorldName,
  type BranchName,
} from '@ontos/kernel'

export type ShellContext = {
  api: OntosShellApi
  host: RuntimeHost
  world: WorldName
  branch: BranchName
  /** Called on clean exit — closes all active listeners */
  close: () => Promise<void>
}

export async function makeShellContext(
  world: WorldName,
  branch: BranchName,
  dataDir: string,
): Promise<ShellContext> {
  const resolvedDir = path.resolve(process.cwd(), dataDir)
  const store = new JsonFileStore(resolvedDir)
  const registry = new TraitRegistry()
  const host = new RuntimeHost()
  const api = new OntosShellApi(store, registry, host)

  // Create the world if it doesn't exist yet
  const existing = await api.getRevision(world, branch)
  if (!existing) {
    await api.createWorld(world)
  }

  return {
    api,
    host,
    world,
    branch,
    close: async () => { await host.closeAll() },
  }
}
