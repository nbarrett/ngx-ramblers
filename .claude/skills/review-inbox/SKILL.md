---
name: review-inbox
description: >
  Fetch an NGX committee inbox thread (messages and attachments) and, when asked,
  review it and draft a non-vcs reply. Use when the user pastes an /admin/inbox?thread=
  URL, names an inbox thread slug, asks to review inbox mail or prep a reply, or runs /review-inbox.
argument-hint: <inbox-url-or-thread-slug>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Review an NGX inbox thread

Read `.claude/skills/connect-env-db/SKILL.md` first. Credentials, `CMS_URL` and `with-cms-login.sh` live there. Do not copy hosts, usernames or passwords into this skill. Do not write an inbox client. The list and thread endpoints, slug helpers, and attachment URLs already exist.

## Arguments

`$ARGUMENTS` — an `/admin/inbox?thread=` URL, a thread slug, or empty to list recent threads.

## Fetch

The pasted URL names the site. Set `CMS_URL` to that origin. If there is no URL, leave the connect-env-db default.

From `server/`, login with `cms-client` and call the existing inbox API. The `thread=` query value is the API identifier (subject slug or Mongo id):

```ts
import {inboxAttachmentUrl, inboxThread, inboxThreads, login} from "./lib/shared/cms-client";

const auth = await login(process.env.CMS_URL, process.env.CMS_USERNAME, process.env.CMS_PASSWORD);
const detail = await inboxThread(auth, slug);
```

Wrap with connect-env-db's helper:

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script>
```

`inboxThread(auth, slug)` is `GET /api/inbox/threads/:id`, where `:id` is the URL slug or the Mongo id. Attachments are `${baseUrl}/api/aws/s3/${s3Key}` via `inboxAttachmentUrl`. Read those files with the existing Read tool. Do not re-fetch.

No slug: `inboxThreads(auth)` and stop.

## Review and draft

If the user asked to review or reply:

1. Read neighbouring drafts in `non-vcs/emails/` for the same people (Head office lives in `non-vcs/emails/ramblers-hq/`). Do not treat an unsent draft as sent.
2. If the thread is Team Emails / the Ramblers-published API, follow the `salesforce` skill for product naming and evidence rules.
3. Write a review note and, when a reply was asked for, a sendable draft under `non-vcs/emails/`. Match the local sign-off used to that person. Apply `unslop`. UK English. Head office, never HQ.
4. Do not send.

Show the user the substance of the thread and the draft, not how the fetch worked.
