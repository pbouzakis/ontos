import { randomUUID } from 'crypto'
import type { LogEntry, LogEntryCause, Effect, WorldOp, RevisionId } from '../types'

type CreateLogEntryOptions = {
  revisionId: RevisionId
  parentRevisionId?: RevisionId
  cause: LogEntryCause
  effects: Effect[]
  appliedOps: WorldOp[]
}

export function createLogEntry(opts: CreateLogEntryOptions): LogEntry {
  return {
    id: randomUUID(),
    revisionId: opts.revisionId,
    parentRevisionId: opts.parentRevisionId,
    timestamp: new Date().toISOString(),
    cause: opts.cause,
    effects: opts.effects,
    appliedOps: opts.appliedOps,
  }
}
