# CMS API Full Reference

## Complete Working Example: Create/Update Pages

```javascript
const BASE_URL = "https://ngx-ramblers-bolton.fly.dev"; // or any NGX Ramblers site

// 1. Login
async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/database/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, password })
  });
  const data = await response.json();
  return { baseUrl, authToken: data.tokens.auth };
}

// 2. Get page content
async function getPageContent(auth, path) {
  const criteria = { path: { $eq: path } };
  const url = `${auth.baseUrl}/api/database/page-content?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${auth.authToken}`, "Content-Type": "application/json" }
  });
  const data = await response.json();
  if (data.action === "query" && data.response) {
    return { id: data.response.id, path: data.response.path, rows: data.response.rows || [] };
  }
  return null;
}

// 3. Create page
async function createPageContent(auth, content) {
  const response = await fetch(`${auth.baseUrl}/api/database/page-content`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${auth.authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(content)
  });
  return response.json();
}

// 4. Update page
async function updatePageContent(auth, id, content) {
  const response = await fetch(`${auth.baseUrl}/api/database/page-content/${id}`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${auth.authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...content, id })
  });
  return response.json();
}
```

## Row Type Templates

### Text Row
```javascript
function textRow(markdown) {
  return {
    type: "text",
    showSwiper: false,
    maxColumns: 12,
    columns: [{
      columns: 12,
      contentText: markdown,
      accessLevel: "public"
    }]
  };
}
```

### Events Row (Filtered Walks)
```javascript
function eventsRow(eventIds, fromDate, toDate) {
  return {
    type: "events",
    maxColumns: 2,
    showSwiper: false,
    columns: [{ columns: 12, accessLevel: "public" }],
    events: {
      fromDate: fromDate,           // Milliseconds since epoch
      toDate: toDate,
      filterCriteria: "DATE_RANGE",
      sortOrder: "DATE_ASCENDING",
      minColumns: 1,
      maxColumns: 2,
      eventTypes: ["group-walk"],   // MUST be lowercase!
      eventIds: eventIds,           // Array of walk IDs, or [] for all
      allow: {
        quickSearch: false,
        pagination: false,
        alert: false,
        autoTitle: false,
        addNew: false
      }
    }
  };
}
```

### Action Buttons Row
```javascript
function actionButtonsRow(buttons) {
  return {
    type: "action-buttons",
    showSwiper: false,
    maxColumns: buttons.length,
    columns: buttons.map(btn => ({
      columns: Math.floor(12 / buttons.length),
      title: btn.title,
      href: btn.href,
      contentText: btn.description,
      imageSource: btn.imageSource || null,
      accessLevel: btn.accessLevel || "public"
    }))
  };
}
```

## Querying Walks/Events

### Get All Walks
```javascript
const response = await fetch(`${baseUrl}/api/database/group-event/all`);
const data = await response.json();
const walks = data.response; // Array of walk objects
```

### Walk Object Structure
```javascript
{
  id: "697c823fa1ec22132c79d245",
  groupEvent: {
    title: "GM Ringway Stage 5 - Strines to Middlewood",
    start_date_time: "2026-02-14T11:00:00",
    end_date_time: "2026-02-14T16:00:00",
    description: "<p>Walk description...</p>",
    distance_miles: 8.2,
    difficulty: { code: "moderate", description: "Moderate" },
    start_location: { latitude: 53.4, longitude: -2.0, postcode: "..." }
  }
}
```

### Categorizing Walks by Pattern
```javascript
function categorizeWalk(walk) {
  const title = walk.groupEvent?.title?.toLowerCase() || "";
  const date = new Date(walk.groupEvent?.start_date_time);
  const dayOfWeek = date.getDay();  // 0=Sun, 4=Thu, 6=Sat
  const hour = date.getHours();

  if (title.includes("ringway")) return "gm-ringway";
  if (title.includes("horwich") || title.includes("leisure centre")) return "thursday";
  if (dayOfWeek === 2) return "tuesday-ramble";
  if (dayOfWeek === 0 && hour >= 12) return "local-short";  // Sunday afternoon
  if ((dayOfWeek === 0 || dayOfWeek === 6) && hour < 12) return "longer";
  return "uncategorized";
}
```

## Common Mistakes to Avoid

1. **Event types**: Use `"group-walk"` NOT `"GROUP_WALK"`
2. **Dates**: Must be milliseconds (use `new Date().getTime()`)
3. **Page fragments**: Use `#` suffix (e.g., `walks#page-header`)
4. **Auth header**: `Authorization: Bearer ${token}`

## Existing CMS Client
The project already has a CMS client at `server/lib/release-notes/cms-client.ts` with:
- `login(baseUrl, username, password)`
- `pageContent(auth, path)`
- `createPageContent(auth, content)`
- `updatePageContent(auth, id, content)`
- `createOrUpdatePageContent(auth, content)`
