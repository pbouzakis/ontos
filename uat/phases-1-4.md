# UAT: Phases 1–4 — Core Runtime, Traits, Messages, CLI

## Setup

```bash
pnpm build    # required — builds packages/dist/ which pkg load depends on
ontos repl --world uat1 --data-dir /tmp/ontos-uat
```

> **Note:** The trait registry is in-memory only. `pkg load` must be re-run at the start of every REPL session. If you restart the REPL and skip `pkg load`, any `message send/preview` on a node with expressed traits will throw `"Trait not found"`.

---

## 1. World + persistence

| # | Command | Expected |
|---|---|---|
| 1 | `world show` | Shows world `uat1`, branch `main`, a revision ID |
| 2 | `node list` | 3 kernel nodes: `world-root`, `system.log`, `system.registry` |
| 3 | `exit` then restart REPL with same `--data-dir` | `node list` still shows the 3 nodes — persistence confirmed |
| | _(continue in this restarted REPL session for all remaining steps)_ | |

---

## 2. Nodes + edges

| # | Command | Expected |
|---|---|---|
| 4 | `node create --name "Paradise Lost" --kind Book --slug paradise-lost` | Confirms creation |
| 5 | `node show paradise-lost` | Shows id, slug, kinds `[Book]` |
| 6 | `world history` | 2 entries: bootstrap + create_node |
| 7 | `edge create contains world-root paradise-lost` | Confirms edge |
| 8 | `edge list` | Shows the edge with id |
| 9 | `edge remove <edgeId from step 8>` | Confirms removal |
| 10 | `edge list` | Empty |

---

## 3. Trait system + messages

| # | Command | Expected |
|---|---|---|
| 11 | `pkg load packages/dist/index.js` | Lists 4 traits: `reading.lifecycle`, `reading.list`, `reading.query`, `server.lifecycle` |
| 12 | `op apply express_trait --payload '{"nodeId":"<paradise-lost-id>","trait":"reading.lifecycle"}'` | Succeeds |
| 13 | `node show paradise-lost` | `traits` includes `reading.lifecycle` |
| 14 | `message preview paradise-lost mark_active` | Shows would-be revision with `status: active` — **not committed** |
| 15 | `node show paradise-lost` | State still empty (preview did not persist) |
| 16 | `message send paradise-lost mark_active` | Returns a new revision ID |
| 17 | `node show paradise-lost` | `state["reading.lifecycle"].status === "active"` |
| 18 | `message send paradise-lost mark_finished` | Succeeds |
| 19 | `node show paradise-lost` | `status === "finished"` |
| 20 | `world history` | 5+ log entries |

---

## 4. Server trait + runtime listeners

```bash
ontos repl --world uat-srv --data-dir /tmp/ontos-uat
```

| # | Command | Expected |
|---|---|---|
| 21 | `pkg load packages/dist/index.js` | Loaded |
| 22 | `node create --name "My Server" --kind Server --slug my-server` | Created |
| 23 | `op apply express_trait --payload '{"nodeId":"<id>","trait":"server.lifecycle"}'` | Succeeded |
| 24 | `message send my-server start_server --payload '{"port":9000}'` | Succeeds; produces `open_listener` effect |
| 25 | `runtime listeners` | Shows an active HTTP/TCP listener |
| 26 | `message send my-server stop_server` | Succeeds |
| 27 | `runtime listeners` | Empty |

---

## Pass criteria

All 27 checks pass with no errors.
