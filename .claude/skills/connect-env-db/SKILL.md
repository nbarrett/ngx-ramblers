---
name: connect-env-db
description: >
  Resolve MongoDB and infrastructure credentials for NGX-Ramblers without copying
  hosts, tokens or passwords into skill files. Use when connecting to an environment
  database, looking up Fly/Cloudflare/AWS/CMS credentials, running flyctl, or asking
  where a credential is kept. Use when the user runs /connect-env-db.
argument-hint: <environment-name-or-config-path> [query-or-action]
allowed-tools: Read, Bash
---

# Connect to an NGX-Ramblers environment database

## Which database you have

Never put a cluster host, database name or password in this skill. Read them at run time.

**Contributor / local group checkout.** You have one group's secrets file (`non-vcs/secrets/secrets.<app-name>.env`) and `non-vcs/secrets/environments.local.json`. You do not have the platform configuration database. `MONGODB_URI` (in the secrets file, or copied to `server/.env` while the stack is running) is already that group's database. Query it directly. Do not try to look up other groups.

**Maintainer checkout.** `server/.env` may hold a URI that can see the platform `config` document `key: "environments"`. That document lists every environment's `mongo.cluster`, `mongo.db`, `mongo.username` and `mongo.password`. Each environment lives on its own cluster. Do not reuse the URI's host as the target environment.

Tell the two apart:

```bash
mongosh "$MONGODB_URI" --quiet --eval 'var d = db.config.findOne({key:"environments"}); print(d && d.value && d.value.environments ? d.value.environments.length : 0);'
```

A count of `0` means you are on a single-group database. A positive count means you can resolve other environments from that document.

Local stack: `./bin/ngx-cli local dev <environment>` from the repository root. Frontend http://localhost:4200, API http://localhost:5001.

## Arguments

`$ARGUMENTS` — the environment name, and optionally the query or action.

## Contributor: query this group's database

```bash
mongosh "$MONGODB_URI" --quiet --eval '<your query>'
```

If `MONGODB_URI` is not in the shell, read it from `server/.env` or the group's secrets file. Expected shape (placeholders only):

```
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority"
```

Before any write, print something the user can recognise:

```js
var sys = db.config.findOne({key:"system"});
print("group.longName:", sys && sys.value && sys.value.group && sys.value.group.longName);
```

Stop if the group name is not the environment you think you are on.

## Maintainer: resolve another environment

1. Read the platform URI from `server/.env` (`grep MONGODB_URI server/.env`). Do not paste the value into notes or skills.
2. Look up the target:

```bash
mongosh "<PLATFORM_URI>" --quiet --eval '
var envs = db.config.findOne({key:"environments"});
var target = (envs.value.environments || []).find(function(e){ return e.environment === "<ENV_NAME>"; });
print(JSON.stringify(target && target.mongo, null, 2));
'
```

Returns:

```json
{
  "cluster": "<atlas-cluster-host-without-mongodb.net>",
  "db": "ngx-ramblers-<env>",
  "username": "<env>_db_user",
  "password": "<env-specific-password>"
}
```

3. Build `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority`. The `cluster` field already omits `.mongodb.net`.
4. Run the group-name check on that URI before writing.

List environment names if the lookup misses:

```bash
mongosh "<PLATFORM_URI>" --quiet --eval '
db.config.findOne({key:"environments"}).value.environments.map(function(e){ return e.environment; }).forEach(print);
'
```

Do not query `ngx-ramblers-<env>` on the platform cluster and assume it is the live group database. Always use the per-env `mongo.*` fields.

## Writing changes

Read-only queries are fine. For writes:

1. Confirm with the user. Quote the environment name, cluster and database you are about to change.
2. Run the group-name check.
3. Prefer `updateOne` with a precise filter over `updateMany`.
4. Show `matchedCount` / `modifiedCount`.

## Collections

- `config` — keyed documents: `system`, `brevo`, `mail`, `mailchimp`, `environments` (platform database only), `booking`, `committee`, `meetup`, `migration`, `ramblers-areas-cache`, `walks`
- `notificationConfigs`
- `members`, `pageContent`, `contentMetaData`, `banners`
- `walks`, `socialEvents`, `extendedgroupevents`
- `inboxThreads`, `inboxMessages`

## Platform `environments` document (maintainer only)

Present only when the lookup above returns a list. Top-level keys of `value`:

- `environments[]` — per-env Mongo (`.mongo.cluster/db/username/password`)
- `uploadWorker` — `.appName`, `.apiKey`, `.sharedSecret`, `.encryptionKey`, `.memory`, `.scaleCount`
- `cloudflare`, `aws`, `secrets`, `autoDeployTarget`
- `cms` — CMS API login for content-admin scripts (`.username`, `.password`). Never write these into a skill file.

Do not copy tokens into `.env`, a shell profile, or this skill. Pipe them into the one command that needs them.

Dotted-path lookup (platform database only):

```bash
mongosh "$MONGODB_URI" --quiet --eval '
var root = db.config.findOne({key:"environments"}).value;
var path = "<DOTTED_PATH>".split(".");
var cur = root;
for (var i = 0; i < path.length; i++) { if (cur == null) break; cur = cur[path[i]]; }
if (cur == null) { print(""); } else if (typeof cur === "object") { print(JSON.stringify(cur)); } else { print(cur); }
' 2>/dev/null | tail -1
```

`<DOTTED_PATH>` examples: `uploadWorker.apiKey`, `cloudflare.apiToken`, `aws.bucket`, `uploadWorker.appName`, `cms.username`.

Fly logs (maintainer; needs `uploadWorker.apiKey` on the platform document):

```bash
flyctl logs --app "$(mongosh "$MONGODB_URI" --quiet --eval 'print(db.config.findOne({key:"environments"}).value.uploadWorker.appName)' 2>/dev/null | tail -1)" \
  --access-token "$(mongosh "$MONGODB_URI" --quiet --eval 'print(db.config.findOne({key:"environments"}).value.uploadWorker.apiKey)' 2>/dev/null | tail -1)" \
  --no-tail
```

## CMS script login

Content-admin scripts need `CMS_USERNAME` and `CMS_PASSWORD` for a `contentAdmin` member **on the target environment**.

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script> [args]
```

The helper:

1. Uses `CMS_USERNAME` / `CMS_PASSWORD` if already set (the contributor path).
2. Otherwise looks up `cms.username` / `cms.password` on the database behind `MONGODB_URI` or `server/.env` (the maintainer path).
3. Exports them for that one process and execs the command.

Do not echo the values. Do not write them to disk. Do not put them in `SKILL.md`. Default `CMS_URL` is the local API (`http://localhost:5001`). Set `CMS_URL` only when the user names a different site.

## Example — Brevo config on a resolved environment

On a contributor database, query `config` with `key:"brevo"` on `$MONGODB_URI` directly.

On a platform database, resolve `mongo.*` for `<ENV_NAME>` first, build that URI, then:

```bash
mongosh "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority" --quiet --eval '
var b = db.config.findOne({key:"brevo"});
print("contactUs:", b.value.contactUsNotificationConfigId);
'
```
