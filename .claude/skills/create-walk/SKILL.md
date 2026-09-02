---
name: create-walk
description: >
  Create a group walk on an NGX-Ramblers site from a webpage, GPX/OS Maps link, Ramblers walk page, or a written description.
  Use when the user asks to create a walk from a URL or webpage, add a walk to a group's programme from an external page, or runs /create-walk.
argument-hint: <site-url> <walk-url-or-description>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Create a walk from a webpage

You are creating a **group walk** (`item_type: "group-walk"`) on a named NGX-Ramblers site, from a URL or description.

This is the walk equivalent of `create-social-event`. Do not add an admin action button or a new in-app page for it.

## Which site

Never assume EKWG, staging, or localhost branding.

1. The user names the group or pastes its URL. That is the target.
2. If they are on the local stack (`http://localhost:4200` / `http://localhost:5001`), read `group.longName` from that API **before** creating anything. Localhost is whichever database the running stack is pointed at. It is not EKWG unless the group name says East Kent Walking Group.
3. Staging is https://www.ngx-ramblers.org.uk (Fly app `ngx-ramblers`). That is the project site, not a walking group's programme.

Identify the group:

```bash
curl -sS "<BASE_URL>/api/database/group-event/all?limit=1"
```

Use `group_name` / `group_code` from an existing **group-walk** on that site. If the name is not the group you think you are on, stop.

Walks populated from Walks Manager must not be created this way. If recent walks have `source` other than `local`, say so and stop.

## Credentials

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script> [args]
```

Do not put usernames or passwords in this file. Do not use `mongosh` for walks or page content.

## Workflow

### 1. Research the walk

From the supplied URL or description, extract:

- title
- date and start time (Europe/London)
- start place, postcode, grid reference if given
- distance (miles or km), ascent if given, grade/difficulty
- circular or linear
- description (markdown)
- any booking or info URL (`external_url`)
- a suitable image if the page has one

Sources: Ramblers walk pages, OS Maps / GPX pages, another group's walk page, a written brief. Use `WebFetch` / `WebSearch`. For a GPX or OS Maps route to attach after the walk exists, use `import-walk-routes` rather than duplicating that skill here.

### 2. Copy the shape from walks already on this site

Use `cms-client`, not ad-hoc `fetch` (except the public identify-the-group check above).

```ts
import {login, fetchAllWalks, urlFromTitle, createGroupEvent} from "./lib/shared/cms-client";
```

`fetchAllWalks` returns all extended group events. Keep those with `groupEvent.item_type === "group-walk"`. Copy `group_code`, `area_code`, `group_name`, `fields.notifications`, `fields.imageConfig`, `fields.publishing`, and `fields.contactDetails` from a recent walk on **this** site.

### 3. Login and slug

`login(baseUrl, username, password)` via `with-cms-login.sh`. Then `urlFromTitle(auth, title)`.

### 4. Create the walk

`item_type` must be `"group-walk"`. Description is markdown. Dates are ISO 8601 with timezone (`2026-04-24T10:00:00+01:00`). Start place goes in `groupEvent.start_location` (not a social-event `location` field).

```ts
const walk = {
  groupEvent: {
    item_type: "group-walk",
    title: "<title>",
    group_code: "<from an existing walk on this site>",
    area_code: "<from an existing walk on this site>",
    group_name: "<from an existing walk on this site>",
    description: "<markdown>",
    additional_details: "",
    start_date_time: "2026-04-24T10:00:00+01:00",
    end_date_time: "2026-04-24T15:00:00+01:00",
    start_location: {
      latitude: 0,
      longitude: 0,
      postcode: "<postcode>",
      description: "<place name>"
    },
    distance_km: 0,
    distance_miles: 0,
    ascent_feet: 0,
    ascent_metres: 0,
    difficulty: {code: "moderate", description: "Moderate"},
    duration: 0,
    url: slug,
    external_url: "<source page if useful>",
    status: "draft",
    cancellation_reason: "",
    accessibility: [],
    facilities: [],
    transport: [],
    media: [],
    linked_event: "",
    shape: "circular",
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString()
  },
  fields: {
    attendees: [],
    contactDetails: {},
    imageConfig: {},
    links: [],
    milesPerHour: 2.13,
    notifications: [],
    publishing: {meetup: {publish: false}, ramblers: {publish: true}},
    riskAssessment: [],
    inputSource: "manually-created"
  },
  events: [],
  source: "local",
  syncedVersion: 1
};
```

Fill `contactDetails`, `notifications`, `imageConfig`, and `publishing` from the copied walk. Then `createGroupEvent(auth, walk)`.

### 5. Verify

Confirm the create returned the new record. Tell the user the walk title, date, and the site it is on (the group name, not "localhost" or "EKWG").

## Related skills

- `create-social-event` — socials / group-events, not walks
- `import-walk-routes` — GPX / OS Maps geometry onto an existing walk
- `create-walk-photos-page` — album page from a Facebook post or photo set

## Do not

- Create the walk on EKWG, staging, or localhost unless that is the named target and `group.longName` matches
- Use `mongosh`
- Invent a second create path in the UI
- Use `item_type: "group-event"` (that is a social)
- Commit or push unless asked
