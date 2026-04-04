import type { World, WorldName } from '../types'

export interface IStore {
  loadWorld(name: WorldName): Promise<World | null>
  saveWorld(world: World): Promise<void>
  listWorlds(): Promise<WorldName[]>
}
