# Database Migrations

This directory contains database migrations managed by [migrate-mongo](https://github.com/seppevs/migrate-mongo).

## Overview

Migrations run automatically when the server starts. They are:
- **TypeScript + ESM**: All migrations use TypeScript with ES modules for type safety and modern syntax
- **Idempotent**: Safe to run multiple times
- **Tracked**: Applied migrations are stored in the `changelog` collection
- **Locked**: Only one instance can run migrations at a time (TTL: 300s)
- **Environment-aware**: Uses `MONGODB_URI` from environment variables

## Automatic Execution

Migrations run automatically on server startup:
1. Server checks for pending migrations
2. Applies them in chronological order
3. Records each successful migration in the `changelog` collection
4. If any migration fails, the server will not start

## Manual Commands

```bash
# Check migration status
npm run migrate:status

# Run pending migrations (normally done automatically on startup)
npm run migrate

# Rollback last migration
npm run migrate:down

# Create a new migration
npm run migrate:create <migration-name>
```

**Note**: Manual commands require `MONGODB_URI` environment variable to be set.

## Creating New Migrations

1. Create a new migration file:
   ```bash
   npm run migrate:create my-migration-name
   ```

2. Edit the generated file in `migrations/` using ESM syntax:
   ```typescript
   import { Db, MongoClient } from "mongodb";
   import createMigrationLogger from "./migration-logger";

   const debugLog = createMigrationLogger("my-migration-name");

   export async function up(db: Db, client: MongoClient) {
     debugLog("Starting migration...");
     const collection = db.collection("myCollection");
     await collection.updateMany({}, { $set: { newField: "value" } });
     debugLog("Migration completed");
   }

   export async function down(db: Db, client: MongoClient) {
     debugLog("Rolling back migration...");
     const collection = db.collection("myCollection");
     await collection.updateMany({}, { $unset: { newField: "" } });
     debugLog("Rollback completed");
   }
   ```

3. Commit the migration file - it will run automatically on next deployment

## Existing Migrations

### 20240101000000-migrate-media-urls.ts (Retrospective)
Migrates media URLs from old format (`api/aws/s3/...`) to new direct format.

**Purpose**: Remove API proxy prefix from media URLs in groupEvents.

**Note**: This migration was created retroactively from code in `DataMigrationService.migrateMedia()`. If this was already run manually in your environment, mark it as applied:
```bash
npm run migrate:mark-old-applied
```

### 20240101000001-update-osmaps-urls.ts (Retrospective)
Updates OS Maps URLs from old domain (`osmaps.ordnancesurvey.co.uk`) to new domain (`explore.osmaps.com`).

**Purpose**: Update external links to use the new OS Maps domain.

**Note**: This migration was created retroactively from code in `DataMigrationService.updateOsMapsRoute()`. If this was already run manually in your environment, mark it as applied:
```bash
npm run migrate:mark-old-applied
```

### 20251022220737-migrate-inline-content-text.ts
Migrates `contentTextId` references to inline `contentText` in all page content columns, including action buttons, nested rows, and all page content types.

**Purpose**: Eliminates the separate `contentText` collection dependency by inlining text directly into page content documents. Handles all page content types including ACTION_BUTTONS, text columns, and nested structures recursively.

**How it works**:

1. **Scans all page content documents** from the `pageContent` collection
2. **Recursively processes all rows and columns** (including nested rows)
3. For each column that has a `contentTextId` but no `contentText`:
   - Looks up the corresponding document in the `contentText` collection
   - Copies the `text` field to `contentText` on the column
   - **Deletes** the `contentTextId` field (removes it entirely, not set to null)
4. **Only updates documents that changed** using deep equality comparison (`isEqual`)
5. Logs each inlined contentTextId for debugging

**What gets migrated**:
- Regular text columns with `contentTextId`
- ACTION_BUTTONS columns (admin buttons, committee year buttons, etc.)
- Nested rows at any depth (columns can contain rows which contain columns, etc.)
- All page content types (TEXT, ACTION_BUTTONS, slides, carousels, etc.)

**Before** (column structure):
```json
{
  "title": "Migration Settings",
  "icon": "faExchangeAlt",
  "href": "admin/migration-settings",
  "contentTextId": "507f1f77bcf86cd799439011"
}
```

**After** (column structure):
```json
{
  "title": "Migration Settings",
  "icon": "faExchangeAlt",
  "href": "admin/migration-settings",
  "contentText": "Configure settings for migrating content from legacy static websites."
}
```

**Safety features**:
- Skips columns that already have `contentText` (idempotent)
- Handles missing contentText documents gracefully (logs error, continues)
- Only updates documents with actual changes
- Uses `es-toolkit` `isEqual` for robust comparison (avoids property order issues)

### 20251022220623-cleanup-duplicate-page-content.ts
Removes duplicate page content entries and creates a unique index on the `path` field.

**Purpose**:
- Cleans up existing duplicates (keeps most recently updated)
- Prevents future duplicates via unique constraint

### 20260113000000-reverse-geocode-missing-postcodes.ts
Reverse geocodes walks that have coordinates but are missing postcodes.

**Purpose**: Populate missing postcode data from existing latitude/longitude coordinates.

**How it works**:
1. Finds walks with `startLocationLatitude` and `startLocationLongitude` but missing `startLocationPostcode`
2. Calls postcodes.io reverse geocoding API with the coordinates
3. Validates the result is within 50 miles of the area center (configurable)
4. Populates postcode and grid reference fields (6, 8, 10 digit formats)
5. Creates audit events tracking the geocoding source

**External API**: [postcodes.io](https://postcodes.io/) (free, no API key required)

### 20260113000001-geocode-from-title-description.ts
Extracts location information from walk titles and descriptions for walks still missing postcodes.

**Purpose**: Use text analysis to geocode walks that couldn't be reverse geocoded from coordinates.

**How it works**:
1. Finds walks still missing `startLocationPostcode` after the reverse geocoding migration
2. Extracts location candidates from title and description using regex patterns:
   - UK postcodes (`SW1A 1AA`)
   - OS grid references (`TQ308806`)
   - Place names ("walk from X to Y", "meet at X", etc.)
3. Prioritises matches: postcode > grid reference > place name
4. Geocodes using Nominatim with UK filtering and county preference
5. Populates location fields and tracks the match type (`GeocodeMatchType`)

**External APIs**:
- [postcodes.io](https://postcodes.io/) — postcode and grid reference lookup
- [Nominatim](https://nominatim.openstreetmap.org/) — place name geocoding

**Match Types** (`GeocodeMatchType` enum):
- `COORDINATES` — existing lat/lng
- `POSTCODE` — extracted UK postcode
- `GRID_REFERENCE` — extracted OS grid reference
- `PLACE_NAME` — geocoded place name
- `TITLE_EXTRACTION` — place name from walk title
- `START_LOCATION` — explicit start location text

## Best Practices

1. **Test First**: Test migrations on local/staging before production
2. **Backup**: Always have a database backup before major migrations
3. **Idempotent**: Design migrations to be safely run multiple times
4. **Atomic**: Keep migrations focused on a single logical change
5. **Rollback**: Implement `down()` when possible (not all migrations are reversible)

## Troubleshooting

### Migration Fails on Startup
If a migration fails, the server will not start. Check logs for error details:
```
Migration failed: <error message>
Server will not start until migrations are successful
```

**Resolution**:
1. Fix the migration code
2. Or manually rollback: `npm run migrate:down`
3. Restart the server

### Check Health Status
The `/api/health` endpoint includes migration status:
```json
{
  "status": "OK",
  "migrations": {
    "pending": 0,
    "applied": 2,
    "failed": false
  }
}
```

Status will be `DEGRADED` (HTTP 503) if migrations are pending or failed.

## Site Maintenance Page

When migrations are pending or have failed, the application automatically shows a maintenance page to users:

### For Regular Users
- Redirected to `/admin/site-maintenance` automatically on app load
- Shows current migration status (pending/failed)
- Displays a loading spinner and message
- Page auto-refreshes every 5 seconds
- Automatically redirects to home when migrations complete

### For Admin Users
- Can access the site normally even when migrations are pending/failed
- Maintenance page shows additional admin controls:
  - **Retry Migrations** button to manually trigger migration retry
  - **View Logs** button to open health endpoint
  - Real-time status updates
  - Success/failure messages after retry attempts

### How It Works
1. **App Initialization**: On startup, Angular checks migration status via `/api/health`
2. **Status Check**: If migrations are pending/failed, app redirects to maintenance page
3. **Admin Bypass**: Admins (`memberHasAnyPrivilege()`) can bypass and access site normally
4. **Auto-Recovery**: Once migrations succeed, users are automatically redirected to home

### API Endpoints
- `GET /api/health` - Get current migration status (public)
- `GET /api/database/migrations/status` - Detailed migration info (public)
- `POST /api/database/migrations/retry` - Retry pending migrations (requires auth)

### Component Location
- **Frontend**: `projects/ngx-ramblers/src/app/pages/admin/site-maintenance/site-maintenance.component.ts`
- **Service**: `projects/ngx-ramblers/src/app/services/site-maintenance.service.ts`
- **Initializer**: `projects/ngx-ramblers/src/app/services/site-maintenance-initializer.ts`
- **API**: `server/lib/mongo/routes/migrations.ts`

## Configuration

Configuration is in `migrations/migrate-mongo-config.ts`:
- **URL**: Uses `MONGODB_URI` environment variable
- **Migrations Dir**: `migrations/`
- **File Extension**: `.ts` (TypeScript)
- **Changelog Collection**: `changelog`
- **Lock Collection**: `changelog_lock` (TTL: 300s)

All npm migration scripts automatically use the config file in the migrations folder.
