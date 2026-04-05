export type ApiNode = {
  id: string
  slug: string
  name?: string
  kinds: string[]
  url: string
  state: Record<string, Record<string, unknown>>
  traits: string[]
  createdAt: string
  updatedAt: string
  archived?: boolean
}

export type ApiEdge = {
  id: string
  type: string
  from: string
  to: string
  state?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ApiRevision = {
  id: string
  parentId?: string
  timestamp: string
  cause: { type: string; [k: string]: unknown }
}

export type ApiRevisionFull = {
  id: string
  nodes: Record<string, ApiNode>
  edges: Record<string, ApiEdge>
}

export type ServerConfig = { world: string; branch: string }

export async function fetchServerConfig(): Promise<ServerConfig> {
  const res = await fetch('/config')
  if (!res.ok) throw new Error('Failed to fetch server config')
  return res.json()
}

export class OntosClient {
  constructor(
    private world: string,
    private branch: string,
    private readonly base = '',
  ) {}

  setConfig(world: string, branch: string): void {
    this.world = world
    this.branch = branch
  }

  private url(path: string): string {
    return `${this.base}${path}`
  }

  async listNodes(): Promise<ApiNode[]> {
    const res = await fetch(this.url(`/worlds/${this.world}/branches/${this.branch}/nodes`))
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async getNode(id: string): Promise<ApiNode> {
    const res = await fetch(this.url(`/worlds/${this.world}/branches/${this.branch}/nodes/${id}`))
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async listRevisions(): Promise<ApiRevision[]> {
    const res = await fetch(this.url(`/worlds/${this.world}/branches/${this.branch}/revisions`))
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async execCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const res = await fetch(this.url('/shell/exec'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  subscribeToEvents(onRevision: (revisionId: string) => void): () => void {
    const es = new EventSource(this.url('/events'))
    es.addEventListener('revision', (e) => onRevision((e as MessageEvent).data))
    return () => es.close()
  }
}
