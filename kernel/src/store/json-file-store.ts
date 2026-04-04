import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'
import type { World, WorldName } from '../types'
import type { IStore } from './interface'

export class JsonFileStore implements IStore {
  constructor(private readonly dataDir: string) {}

  private pathFor(name: WorldName): string {
    return join(this.dataDir, `${name}.json`)
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true })
  }

  async loadWorld(name: WorldName): Promise<World | null> {
    try {
      const raw = await readFile(this.pathFor(name), 'utf-8')
      return JSON.parse(raw) as World
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async saveWorld(world: World): Promise<void> {
    await this.ensureDir()
    await writeFile(this.pathFor(world.name), JSON.stringify(world, null, 2), 'utf-8')
  }

  async listWorlds(): Promise<WorldName[]> {
    try {
      const entries = await readdir(this.dataDir)
      return entries.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }
}
