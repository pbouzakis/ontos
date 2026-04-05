# UAT: Phase 6 — HTTP API + Web UI

## Setup

```bash
ontos serve --world uat1 --data-dir /tmp/ontos-uat --port 3000
```

Assumes `uat1` world exists with `paradise-lost` node from phases 1–4 UAT.

---

## 1. HTTP API

Run these in a second terminal:

| # | Command | Expected |
|---|---|---|
| 1 | `curl -s http://localhost:3000/config` | `{"world":"uat1","branch":"main"}` |
| 2 | `curl -s http://localhost:3000/worlds/uat1/branches/main/nodes \| jq '.[].slug'` | Includes `paradise-lost` |
| 3 | `curl -s http://localhost:3000/worlds/uat1/branches/main/nodes/paradise-lost \| jq '.state'` | Shows `reading.lifecycle` state |
| 4 | `curl -s http://localhost:3000/worlds/uat1/branches \| jq '.[].name'` | `"main"` (and `"feature"` if Phase 5 UAT was run) |
| 5 | `curl -s http://localhost:3000/worlds/uat1/branches/main/revisions \| jq '.[0]'` | Object with `id`, `timestamp`, `cause` |
| 6 | `curl -s -X POST http://localhost:3000/worlds/uat1/branches/main/nodes/paradise-lost/message -H 'Content-Type: application/json' -d '{"type":"mark_want_to_read"}' \| jq '.revisionId'` | A UUID string |
| 7 | `curl -s http://localhost:3000/worlds/uat1/branches/main/nodes/nonexistent` | `{"error":"Node \"nonexistent\" not found"}` with status 404 |
| 8 | `curl -s -X POST http://localhost:3000/shell/exec -H 'Content-Type: application/json' -d '{"command":"node list"}' \| jq '.stdout'` | Multi-line string listing nodes |

---

## 2. SSE

Open a third terminal and run:

```bash
curl -N http://localhost:3000/events
```

Then in another terminal send a message (step 6 above). You should see:

```
event: revision
data: <some-uuid>
```

| # | Check | Expected |
|---|---|---|
| 9 | SSE stream stays open after connecting | No immediate close |
| 10 | Sending a message via API emits a `revision` event on the stream | Event appears within ~1 second |

---

## 3. Browser UI

Open `http://localhost:3000` in a browser.

| # | Check | Expected |
|---|---|---|
| 11 | Page loads | Graph canvas visible, no blank screen |
| 12 | Header shows correct world/branch | `uat1/main` (not `…/…`) |
| 13 | Nodes appear as graph nodes | At least 3 kernel nodes + `paradise-lost` visible |
| 14 | Click `paradise-lost` | Inspector panel opens on the right |
| 15 | Inspector shows state | `reading.lifecycle` section with `status` field |
| 16 | Inspector shows history | List of log entries in reverse order |
| 17 | Press Escape | Inspector closes |
| 18 | Press `` ` `` | Shell panel opens at the bottom |
| 19 | Type `node list` + Enter | Node list output appears in panel |
| 20 | Type `message send paradise-lost mark_active` + Enter | Command runs; graph refreshes automatically (SSE) |
| 21 | Click `paradise-lost` again | Inspector shows updated `status: active` |
| 22 | Press `` ` `` | Shell panel closes |

---

## Pass criteria

All 22 checks pass. UI displays the correct world, graph updates live without page refresh, shell panel executes commands end-to-end.
