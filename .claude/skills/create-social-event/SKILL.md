---
name: create-social-event
description: Create a social event on an NGX-Ramblers site. Use when the user asks to create a social event, group event, or outing — possibly inspired by a URL, flyer, or description. Handles web research, event detail extraction, image sourcing, CMS login, and ExtendedGroupEvent creation via the API.
argument-hint: <site-url> <event-description-or-url>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Create Social Event on NGX-Ramblers

You are creating a social event (group-event) on an NGX-Ramblers website.

## Arguments

`$ARGUMENTS` — the target site URL and either a description of the event or URLs to research (e.g. YouTube links, Bandsintown, venue pages, flyers).

## Credentials

Wrap CMS commands with `.claude/skills/connect-env-db/scripts/with-cms-login.sh`. Default `CMS_URL` is `http://localhost:5001`. Do not put usernames or passwords in this file.

## Workflow

### 1. Research the Event

If the user provides URLs (YouTube, Bandsintown, venue sites, etc.):
- Use `WebFetch` and `WebSearch` to extract event details: artist/performer, date, time, venue, location, postcode, ticket price, description
- For YouTube videos, use the oEmbed endpoint to get the title/artist: `https://www.youtube.com/oembed?url=<VIDEO_URL>&format=json`
- Search for the specific event near the target group's area (read `group.longName` / area from the site's system config)
- Find the official venue page for authoritative details (date, time, price, booking link)
- Find a high-quality promotional image (check artist management sites like Opus 3 Artists, official websites, press pages)

### 2. Examine Existing Events

Fetch existing group-events to understand the exact data structure used on the target site:

```javascript
const eventsResp = await fetch(`${BASE_URL}/api/database/group-event/all`);
const events = (await eventsResp.json()).response;
const socialEvents = events.filter(e => e.groupEvent?.item_type === "group-event");
```

Copy the structure exactly — especially `fields.notifications`, `fields.imageConfig`, `fields.publishing`, and `fields.contactDetails` from a recent event on the same site.

### 3. Login

```javascript
const loginResp = await fetch(`${BASE_URL}/api/database/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userName: username, password: password })
});
const authToken = (await loginResp.json()).tokens.auth;
```

### 4. Generate URL Slug

```javascript
const slugResp = await fetch(`${BASE_URL}/api/database/group-event/url-from-title`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${authToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ title: eventTitle })
});
const slug = (await slugResp.json()).response.url;
```

### 5. Create the ExtendedGroupEvent

**CRITICAL:** Social events use `item_type: "group-event"` in the `extendedGroupEvents` collection — NOT the legacy `socialEvents` collection. The social page's events row filters by `eventTypes: ["group-event"]`.

```javascript
const groupEvent = {
  groupEvent: {
    item_type: "group-event",        // MUST be lowercase with hyphen
    title: "Event Title",
    group_code: "<from an existing event on this site>",
    area_code: "<from an existing event on this site>",
    group_name: "<from system config group.longName>",
    description: markdownDescription, // Use MARKDOWN, not HTML
    additional_details: "",
    start_date_time: "2026-04-24T19:30:00+01:00",  // ISO 8601 with timezone
    end_date_time: "2026-04-24T21:30:00+01:00",
    location: {
      latitude: 0,
      longitude: 0,
      postcode: "<venue postcode>",
      description: "Venue Name, Address"
    },
    distance_km: 0,
    distance_miles: 0,
    ascent_feet: 0,
    ascent_metres: 0,
    difficulty: { code: "moderate", description: "Moderate" },
    duration: 0,
    url: slug,                       // From step 4
    external_url: "https://venue-booking-link.com",
    status: "draft",
    cancellation_reason: "",
    accessibility: [],
    facilities: [],
    transport: [],
    media: [{
      alt: "Event Title",
      title: "Event Title",
      credit: "Photographer Name",
      caption: "Image caption",
      styles: [{
        style: "medium",
        url: "https://example.com/press-photo.jpg",  // External URL or images-social-events/uuid.ext
        width: 1600,
        height: 900
      }]
    }],
    linked_event: "",
    shape: "",
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString()
  },
  fields: {
    attendees: [],
    contactDetails: { /* Copy from a recent event on the site */ },
    imageConfig: { /* Copy from a recent event on the site */ },
    links: [{
      title: "Book tickets",
      url: "https://venue-link.com",
      source: "external"
    }],
    milesPerHour: 2.13,
    notifications: [ /* Copy entire notifications array from a recent event on the site */ ],
    publishing: {
      meetup: { publish: false },
      ramblers: { publish: true }
    },
    riskAssessment: [],
    inputSource: "manually-created"
  },
  events: [],
  source: "local",
  syncedVersion: 1
};
```

### 6. POST to API

```javascript
const response = await fetch(`${BASE_URL}/api/database/group-event`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${authToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(groupEvent)
});
```

### 7. Verify

Confirm the event was created (201 status) and tell the user to check the social page.

## Critical Rules

1. **Use `item_type: "group-event"`** — NOT the legacy `/api/database/social-event` endpoint
2. **Description must be markdown** — NOT HTML. Use `**bold**`, `*italic*`, `[link](url)` etc.
3. **Copy site-specific fields** from existing events: `group_code`, `area_code`, `group_name`, `contactDetails`, `notifications`, `imageConfig`
4. **Use ISO 8601 dates with timezone** — e.g. `"2026-04-24T19:30:00+01:00"`
5. **Find a quality image** — check artist/venue press pages, management agencies (Opus 3 Artists, etc.), official websites
6. **Include booking/ticket links** — both in `external_url` and in the markdown description
7. **Write compelling descriptions** — make it attractive to the group, mention why it's special, include practical details (parking, booking phone number, programme length)
8. **Never commit or push** without explicit instruction
