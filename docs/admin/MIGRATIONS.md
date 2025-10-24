# Database Migrations – Admin Guide

This document explains how database migrations work in NGX‑Ramblers: how they are discovered, executed, surfaced in the UI, and how to troubleshoot or test them.

## Overview

- Location: `server/lib/mongo/migrations/database/`
- File naming: `YYYYMMDDhhmmss-description.ts` (14‑digit timestamp, hyphen, name)
- Required export: `export async function up(db: Db, client: MongoClient)`
- Tracking collection: `changelog` (configurable)
- Config file: `server/lib/mongo/migrations/migrations-config.ts`
- Runner: `server/lib/mongo/migrations/migrations-runner.ts`
- Health endpoint: `/api/health` (typed `HealthResponse`)
- UI route: `/admin/site-maintenance` (admins see controls; non‑admins see a slim view)

## Configuration

- File: `server/lib/mongo/migrations/migrations-config.ts`
- Important fields:
  - `mongodb.url`, `mongodb.options` – connection to MongoDB
  - `migrationsDir` – path to the migrations directory (`__dirname` points to config file location)
  - `changelogCollectionName` – where applied migrations are recorded (default: `changelog`)
  - `migrationFileExtension` – `.ts` in dev, `.js` in production
  - `lockCollectionName`, `lockTtl`, `useFileHash`, `moduleSystem` – currently unused by the custom runner but kept for compatibility

## Migration Runner

- File: `server/lib/mongo/migrations/migrations-runner.ts`
- Discovery
  - Loads `server/lib/mongo/migrations/migrations-config.ts`
  - Lists files in `migrationsDir` with the configured extension
  - Filters strictly to timestamped names: 14 digits + hyphen (prevents accidental execution of config/logger/README)
- Status (`migrationStatus()`)
  - Returns `MigrationStatus` with array of `MigrationFile` objects
  - Each `MigrationFile` contains: `fileName`, `status` (PENDING/APPLIED/FAILED), optional `timestamp`, optional `error`
  - Combines filesystem data with `changelog` collection entries
  - Startup logs show counts: `Migration status: X applied, Y pending, Z failed`
- Execution
  - On server start, `server/lib/server.ts` calls `runPendingMigrations()`
  - Each pending file is dynamically imported and must export `up(db, client)`
  - After successful `up`, inserts `{ fileName, appliedAt }` into `changelog`
  - If migration fails, inserts `{ fileName, appliedAt, error }` and stops processing
  - Server continues to start even on failure; frontend shows maintenance mode for non‑admins
- Simulation Functions (testing only)
  - `setMigrationSimulation(pending, failed)` – Creates `changelogSimulation` collection by copying `changelog`, adds simulated failed entries, updates `systemConfig.activeChangelogCollection` to `changelogSimulation`
  - `clearMigrationSimulation()` – Drops `changelogSimulation` collection, resets `systemConfig.activeChangelogCollection` to `changelog`
  - `readMigrationSimulation()` – Returns `{ active: boolean, collection: string }` based on current `systemConfig.activeChangelogCollection`
  - Collection switching is DRY: simulation = using `changelogSimulation` instead of `changelog`; both use identical schema

## Health Endpoint

- File: `server/lib/health/health.ts`
- Route: `GET /api/health`
- Status:
  - `200 OK` when no failures and `pending === 0`
  - `503` when degraded (pending or failed)
- Payload (typed by `projects/ngx-ramblers/src/app/models/health.model.ts`):
  - `status`: `OK | DEGRADED`
  - `environment`: `{ env, nodeEnv }` (full details for admins only)
  - `aws`: `{ region, bucket }` (full details for admins only)
  - `group`: `{ shortName, groupCode }` (full details for admins only)
  - `timestamp`: ISO string
  - `migrations`:
    - `pending`: count of pending migrations
    - `applied`: count of applied migrations
    - `failed`: boolean indicating if any failed
    - `files`: array of `MigrationFile` objects (admin only, includes all details)
- Logs: the endpoint logs the full response object via the `health` namespace

## Admin and User Experience

- Route: `/admin/site-maintenance`
  - Admins (any privilege) see controls + details including sortable table of all migrations
  - Non‑admins see a slim message and spinner; page auto‑refreshes every 5s
- App initializer: non‑admins are redirected to `/admin/site-maintenance` when health is degraded
  - File: `projects/ngx-ramblers/src/app/services/site-maintenance-initializer.ts`

## Admin Controls (in `/admin/site-maintenance`)

- Migration table (sortable by status, filename, or timestamp)
  - Uses `sortBy` utility from `arrays.ts` with enum-based column selection (`MigrationSortColumn`)
  - Sort direction uses project-standard `ASCENDING`/`DESCENDING` constants (arrow symbols)
  - Shows all migrations with their status badges (Applied=green, Failed=red, Pending=warning)
  - Displays timestamps for when migrations were applied/failed
  - Shows error messages for failed migrations inline in red alert boxes
  - Individual "Re-run"/"Run"/"Retry" buttons for each migration
    - Calls `POST /api/database/migrations/retry/:fileName` (auth required)
    - Deletes previous changelog entry and re-runs the migration
- Retry all migrations
  - Button in UI calls `POST /api/database/migrations/retry` (auth required)
  - Endpoint: `server/lib/mongo/routes/migrations.ts`
  - Returns `MigrationRetryResult` with `success`, optional `message`/`error`, and `appliedFiles` array
- View logs
  - Opens `/api/health` in a new tab to see the current status JSON
- Simulate failure (testing only)
  - UI buttons call:
    - `POST /api/database/migrations/simulate-failure` with `{ pending, failed }`
    - `POST /api/database/migrations/clear-simulation`
    - `GET /api/database/migrations/simulation` to read current simulation state
  - Simulation works by switching to `changelogSimulation` collection (stored in `systemConfig.activeChangelogCollection`)
  - When enabled: copies all `changelog` entries to `changelogSimulation`, adds simulated failures, sets active collection
  - When cleared: drops `changelogSimulation`, resets to `changelog`
  - Persists across server restarts and works in multi-instance deployments (state stored in systemConfig database)
  - Clear simulation to return to normal operation

## Creating a Migration

1. Create a new file in `server/lib/mongo/migrations/database/` named `YYYYMMDDhhmmss-your-change.ts`
2. Export an `up` function:
   ```ts
   import { Db, MongoClient } from "mongodb";
   export async function up(db: Db, client: MongoClient) {
     const collection = db.collection("pageContent");
     await collection.updateMany(
       { path: { $exists: false } },
       { $set: { path: "default" } }
     );
   }
   ```
3. Start the server; the runner will detect and apply it automatically.

Notes
- Only `up` is supported; there is no automatic rollback. Take backups before destructive changes.
- Names must begin with a 14‑digit timestamp and a hyphen; otherwise the file will be ignored.
- Use meaningful collection names from your MongoDB schema (e.g., `pageContent`, `members`, `walks`, etc.)

## Marking Legacy Migrations as Applied

- Script: `server/lib/mongo/migrations/mark-migrations-applied.ts`
- Purpose: Insert entries into `changelog` for historic migrations so they aren't re‑run
- Behavior:
  - Dynamically imports `server/lib/mongo/migrations/migrations-config.ts`
  - Inserts `{ fileName, appliedAt }` for listed files if not present
- Usage: adjust the `oldMigrationsUseJsExtensionAsThatIsWhatIsInProductionBuild` array then run the script
- Note: Uses `.js` extensions for production-built migrations

## Troubleshooting

- "Migration X does not export an up function"
  - Ensure the file exports `export async function up(db, client)`
  - Check that the file name is correctly timestamped (14 digits)
- "Migration configuration not found"
  - Ensure `server/lib/mongo/migrations/migrations-config.ts` exists and exports a default config
- Non‑admins redirected to home, not maintenance
  - Health is `OK`. Enable a simulated failure or create a pending migration to verify UI behavior
- Files incorrectly treated as migrations
  - Ensure only files named `^\d{14}-.+\.(ts|js)$` are present in `server/lib/mongo/migrations/database/`
  - Helper files (config, logger, README) are ignored if they don't match the timestamp pattern
- Stuck degraded due to simulation
  - Use the UI "Clear Simulation" button or call `POST /api/database/migrations/clear-simulation`
  - Check `systemConfig.activeChangelogCollection` in the `config` collection (should be `changelog` when not simulating)
  - Manually reset: `db.config.updateOne({ key: "SYSTEM" }, { $unset: { "value.activeChangelogCollection": "" } })` and drop `db.changelogSimulation.drop()`
- Migration errors persisted in changelog
  - Failed migrations are recorded with `{ fileName, appliedAt, error }` in `changelog`
  - Use the individual "Retry" button to delete the error entry and re-run
  - Or delete manually: `db.changelog.deleteOne({ fileName: "20XX..." })`
- Migrations show up twice in UI
  - Check for duplicate entries in active changelog collection (should not happen with proper file naming)
  - Verify which collection is active: check `systemConfig.activeChangelogCollection` in config

## Key Files

- Runner: `server/lib/mongo/migrations/migrations-runner.ts:1`
- Health: `server/lib/health/health.ts:1`
- Server startup call: `server/lib/server.ts:140`
- Admin UI: `projects/ngx-ramblers/src/app/pages/admin/site-maintenance/site-maintenance.component.ts:1`
- Frontend initializer: `projects/ngx-ramblers/src/app/services/site-maintenance-initializer.ts:1`
- Health model: `projects/ngx-ramblers/src/app/models/health.model.ts:1`
- Migrations config: `server/lib/mongo/migrations/migrations-config.ts:1`
- Legacy changelog marker: `server/lib/mongo/migrations/mark-migrations-applied.ts:1`

