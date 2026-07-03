---
name: Goutstoso backup scope
description: What the Goutstoso backup/restore system actually covers, and how to extend it when adding new dedicated SQL tables
---

`gs_backups` snapshots only the JSON blob stored in `gs_data` (the client's full app state saved via `save_data`). It does NOT automatically include data that lives in its own dedicated SQL tables (e.g. `gs_lots`, `gs_mouvements_stock`, `gs_users`, `gs_files`).

**Why:** the backup/restore code only reads/writes `gs_data`; anything stored in a separate table is invisible to it unless explicitly merged in.

**How to apply:** when adding a new feature backed by its own SQL table(s) that the user expects to be covered by "sauvegardes":
- On backup creation (manual `save_backup` and the auto-daily hook inside `save_data`), fetch the table's current rows and merge them into the saved JSON under a clearly-namespaced key (e.g. `_lotsTracabilite`) that won't collide with existing client-state keys.
- On `restore_backup`, read that key back out, replay it into the dedicated table(s) inside a transaction (delete + re-insert preserving IDs if there are FK relationships, then reset the sequence), and strip the key before writing the remainder back into `gs_data` — otherwise it leaks into client state and gets needlessly round-tripped on every subsequent `save_data` call.
- Also strip the key defensively in `save_data` in case stale client state ever carries it forward.
