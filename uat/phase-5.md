# UAT: Phase 5 — History Tools (diff, fork, squash)

## Setup

Uses the world created in phases-1-4 UAT (paradise-lost node, reading.lifecycle trait expressed, mark_active + mark_finished sent).

```bash
ontos repl --world uat1 --data-dir /tmp/ontos-uat
```

Run `world history` first and note at least two revision IDs — call them `<revA>` (earlier) and `<revB>` (later).

---

## 1. Revision diff

| # | Command | Expected |
|---|---|---|
| 1 | `world diff <revA> <revB>` | Shows `~ node` for `paradise-lost` (state changed) |
| 2 | `world diff <revB> <revB>` | "No differences between the two revisions." |

---

## 2. Branch fork + switch

| # | Command | Expected |
|---|---|---|
| 3 | `branch list` | Shows `* main  head:xxxxxxxx  ← current` |
| 4 | `branch fork <headRevId> feature` | "Forked branch feature from revision…" |
| 5 | `branch list` | Shows both `main` and `feature` |
| 6 | `branch switch feature` | "Switched to branch feature" |
| 7 | `node list` | Same nodes as main |
| 8 | `node create --name "Moby Dick" --slug moby-dick` | Created on feature branch |
| 9 | `node list` | Shows `moby-dick` |
| 10 | `branch switch main` | Switched back to main |
| 11 | `node list` | `moby-dick` is **not** present |
| 12 | `branch switch nonexistent` | Error: branch does not exist |

---

## 3. Revision squash

| # | Command | Expected |
|---|---|---|
| 13 | `branch switch feature` | Switched to feature |
| 14 | `world history` | Note the first log entry revision ID (`<sq-from>`) and a later one (`<sq-to>`) |
| 15 | `revision squash <sq-from> <sq-to>` | "Squashed N revision(s)…" |
| 16 | `world history` | Squash marker appears; individual entries in that range are gone |
| 17 | `node list` | All nodes still present — state preserved through squash |

---

## Pass criteria

All 17 checks pass. Nodes on forked branch are isolated from main. Squashed world still replays correctly.
