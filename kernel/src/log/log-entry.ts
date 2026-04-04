import { randomUUID } from 'crypto'
import type { LogEntry, LogEntryCause, Effect, WorldOp, RevisionId, BranchName } from '../types'

type CreateLogEntryOptions = {
  revisionId: RevisionId
  parentRevisionId?: RevisionId
  branchName: BranchName
  cause: LogEntryCause
  effects: Effect[]
  appliedOps: WorldOp[]
}

export function createLogEntry(opts: CreateLogEntryOptions): LogEntry {
  return {
    id: randomUUID(),
    revisionId: opts.revisionId,
    parentRevisionId: opts.parentRevisionId,
    branchName: opts.branchName,
    timestamp: new Date().toISOString(),
    cause: opts.cause,
    effects: opts.effects,
    appliedOps: opts.appliedOps,
  }
}
