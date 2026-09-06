# D1 Migration Policy

Migration `005_abracadawhat_match_v2.sql` creates a unique index on `(match_id, player_id)`. Before applying it to any database, run the duplicate preflight against that same database and inspect its output.

For the isolated local database used by tests:

```powershell
node ./scripts/preflight-005.mjs --local
```

The exact read-only query is stored outside migration discovery at `operations/preflight/005-match-player-duplicates.sql`. For an approved target database, execute that query first and treat any returned row as an abort condition. This task did not execute it remotely.

Operational SQL must not be placed in `migrations/`: Wrangler discovers every top-level `.sql` file there as a migration.

If the preflight exits with code `2`, abort the migration and review every reported historical duplicate. Never silently delete, merge, or choose one historical row automatically.

This repository contains migration files `001` through `004` that were historically applied with direct `wrangler d1 execute` commands. Direct execution does not update Wrangler's `d1_migrations` table. Do not claim those databases are migration-tracked and do not run `wrangler d1 migrations apply` blindly: Wrangler currently sees all numbered files as pending on an unbaselined database.

Migration `001` expects the original base schema to exist, so the current `001`-`005` directory is not a standalone empty-database bootstrap. For a new database, initialize the documented base schema and then use `wrangler d1 migrations list/apply` from migration 001 onward. For an existing database, first establish an explicitly reviewed baseline outside this task, then use Wrangler migration tracking for later migrations. No baseline rows are inserted automatically by this repository.
