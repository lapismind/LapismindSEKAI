# D1 Migration Policy

Migration `005_abracadawhat_match_v2.sql` creates a unique index on `(match_id, player_id)`. Before applying it to any database, run the duplicate preflight against that same database and inspect its output.

For the isolated local database used by tests:

```powershell
node ./scripts/preflight-005.mjs --local
```

The exact read-only query is stored outside migration discovery at `operations/preflight/005-match-player-duplicates.sql`. For an approved target database, execute that query first and treat any returned row as an abort condition. This task did not execute it remotely.

Operational SQL must not be placed in `migrations/`: Wrangler discovers every top-level `.sql` file there as a migration.

If the preflight exits with code `2`, abort the migration and review every reported historical duplicate. Never silently delete, merge, or choose one historical row automatically.

This repository contains migration files `001` through `004` that were historically applied with direct `wrangler d1 execute` commands. Direct execution does not update Wrangler's `d1_migrations` table. Do not claim those databases are migration-tracked and do not run `wrangler d1 migrations apply` blindly: Wrangler currently sees the numbered files as pending on an unbaselined database.

Migration `001` expects the original base schema to exist, so the migration directory is not a standalone empty-database bootstrap. For a new database, initialize the documented base schema and then use `wrangler d1 migrations list/apply` from migration 001 onward. For an existing database, first establish an explicitly reviewed baseline outside this task, then use Wrangler migration tracking for later migrations. No baseline rows are inserted automatically by this repository.

Migration `006_legendary_achievement_aliases.sql` is additive and idempotent. It copies only the six approved, provably equivalent legacy unlocks with `INSERT OR IGNORE`; it does not delete old keys or infer any other achievement.

Migration `007_player_match_reports.sql` is additive and locally repeatable through `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. It creates only the private per-player report storage and recent-order index; it does not add a query endpoint or migrate historical matches.

Production remains a Task D4 operation, not a C3 action. D4 must first confirm a backup/recovery point, run the 005 duplicate preflight read-only, establish and review the migration baseline, then explicitly execute 005, 006, and 007 in order against the approved target. C3 performs no remote database command.

Task D1 validates 007 only against isolated local D1 state. It does not run `wrangler d1 migrations apply`, `wrangler d1 execute --remote`, or otherwise change migration tracking or data on a remote database.
