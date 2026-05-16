# Producing a contributor environment bundle

How a maintainer prepares a group-scoped bundle so an external contributor can run
NGX-Ramblers locally against one group's data, holding no credential that reaches
any other group or the live platform.

`ngx-cli local dev <environment>` resolves the environment from the configuration
database first, then from a local manifest at
`non-vcs/secrets/environments.local.json`. A contributor never holds the staging
configuration database, so their setup runs entirely off that manifest plus a
secrets file. See [AGENTS.md](../../AGENTS.md) and [agentic-development.md](agentic-development.md) for the contributor side.

## What a bundle contains

Three things, all scoped to a single group.

### 1. Secrets file — `non-vcs/secrets/secrets.<app-name>.env`

Required keys — the app will not start without these (`REQUIRED_SECRETS` in
`server/lib/shared/secrets.ts`):

| Key | Value | Scope |
|-----|-------|-------|
| `MONGODB_URI` | connection string for the group's own database | a database-scoped user (see below) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user for the group's S3 bucket | a bucket-scoped policy |
| `AWS_BUCKET` | the group's bucket name | one bucket |
| `AWS_REGION` | e.g. `eu-west-2` | — |
| `AUTH_SECRET` | freshly generated, unique to this bundle | — |
| `NODE_ENV` | `development` | — |

Optional keys, only if the contributor needs scraping or the integration worker:

| Key | Value |
|-----|-------|
| `CHROME_VERSION` | the Chrome version pinned for the worker |
| `INTEGRATION_WORKER_SHARED_SECRET` / `INTEGRATION_WORKER_ENCRYPTION_KEY` | freshly generated, unique to this bundle |

### 2. Environments manifest — `non-vcs/secrets/environments.local.json`

```json
{
  "environments": [
    { "environment": "pang-valley", "flyio": { "appName": "ngx-ramblers-pang-valley" } }
  ]
}
```

The `environment` value is what the contributor passes to
`ngx-cli local dev <environment>`. The `flyio.appName` value names the secrets file
(`secrets.<appName>.env`). The manifest carries `appName` only — no Fly API key. A
ready-to-edit template is at `docs/contributing/environments.local.json.example`.

### 3. A database

Covered under [Development data](#development-data) below.

## What a bundle must never contain

- The staging configuration database URI, or any cluster-wide MongoDB user
- Fly.io API tokens (`flyio.apiKey`)
- `CLOUDFLARE_CONFIG`, `ENVIRONMENT_SETUP_API_KEY`, or any other platform setup or
  Cloudflare account credential
- Any other group's secrets, bucket, or database
- The shared platform `secrets`, `aws` or `cloudflare` blocks from
  `config.environments`

If a value would let the holder touch a second group or the live platform, it does
not belong in a contributor bundle.

## Quick path: a local test checkout

`bin/new-contributor-env` does the assembly below in one command, for spinning up a
contributor-style checkout on your own machine:

```
bin/new-contributor-env <environment> <destination-path>
```

Run it from an existing checkout that has the group's secrets file. It clones the
repository to the destination, copies the group's secrets file, generates a fresh
`AUTH_SECRET`, writes the `environments.local.json` manifest, and starts the stack.
Re-running it against an existing destination refreshes that checkout to the latest
`main` and restarts, so it is safe to run repeatedly while iterating.

It copies the real environment file, so it is a testing convenience rather than a
sanitised handover bundle — for a genuine external contributor, assemble the bundle
as described below.

## Producing the bundle — step by step

1. **Database.** Give the contributor a database that is theirs alone: either a
   dedicated MongoDB Atlas database with a user whose role is scoped to that one
   database (not a cluster-wide `atlasAdmin` or `readWriteAnyDatabase` user), or
   instructions to run a local `mongod` and seed it (see Development data).
2. **S3 bucket.** Create or designate the group's bucket and an IAM user whose
   policy allows actions only on `arn:aws:s3:::<bucket>` and
   `arn:aws:s3:::<bucket>/*`. Do not reuse a platform-wide AWS key.
3. **Generate fresh secrets.** Generate a new `AUTH_SECRET`, and — if the worker is
   needed — new `INTEGRATION_WORKER_SHARED_SECRET` and
   `INTEGRATION_WORKER_ENCRYPTION_KEY`. These are unique to the bundle and shared
   with no other environment.
4. **Write the secrets file** at `non-vcs/secrets/secrets.<app-name>.env` with the
   keys listed above.
5. **Write the manifest** at `non-vcs/secrets/environments.local.json` with the
   single environment entry.
6. **Prepare the data** (see below).
7. **Hand over** the two files plus the database. The contributor drops the files
   into `non-vcs/secrets/` in their clone and runs
   `./bin/ngx-cli local dev <environment> --no-docker-worker`.

## Development data

A contributor needs realistic content to work against, but must not be handed live
member personal data.

- **Seeded data.** `./bin/ngx-cli database seed --uri <uri> --database <name>
  --group-name "<Group>"` populates an empty database with sample, non-personal
  data. It needs no staging access and is the simplest starting point.
- **Anonymised copy.** Take a copy of the group's content (pages, walks, photos)
  and anonymise the `members` collection — replacing names, email addresses,
  postcodes and any contact detail with synthetic values — before loading it into
  the contributor's database. Use this when the contributor needs the group's real
  content shape rather than generic samples.

Never copy the `members` collection verbatim into a contributor bundle.

## Verifying the boundary

Before handing a bundle over, confirm:

- `secrets.<app-name>.env` contains no `CLOUDFLARE_CONFIG`, no
  `ENVIRONMENT_SETUP_API_KEY`, and no Fly API token
- `MONGODB_URI` resolves to a database-scoped user, not a cluster admin
- `AWS_ACCESS_KEY_ID` resolves to a bucket-scoped IAM user
- `environments.local.json` lists only the one environment
- `ngx-cli local dev <environment>` starts with the staging database unreachable
