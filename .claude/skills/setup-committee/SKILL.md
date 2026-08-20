---
name: setup-committee
description: Set up committee members and roles on an NGX-Ramblers site. Use when the user provides a list of committee members with roles and asks to configure them on a site. Creates member records, configures committee roles, maps members to roles, and optionally updates the contact-us page with secure contact cards. Also handles updating existing committee configs, committee year pages, year cover images, and committee files (letters/minutes).
argument-hint: <site-url credentials and committee member list>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Set Up Committee Members and Roles on NGX-Ramblers

You are setting up committee members and their roles on an NGX-Ramblers website. This involves creating member records, configuring committee settings, and optionally building a contact-us page.

Also use this skill for committee year pages, year cover images, and attaching letters or minutes.

The committee **home** is `/committee`, not a year page. Parent package:

1. text intro
2. committee-documents with `autoFromFirstActionButton: true`
3. shared-fragment → `fragments/committee-years` (create the fragment page first)
4. optional migrated-from footer

Year pages (`committee/YYYY`) are children: text + year docs (cover on docs row) + the same shared-fragment as the home. Do not treat any year URL as the home.

## Arguments

`$ARGUMENTS` — the target site URL, credentials, and a list of committee members with their roles and email addresses.

## Approach

Write a TypeScript script using the CMS client API and REST calls. Keep one-off scripts out of git. Run from `server/`:

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script>
```

## Three-Step Process

### Step 1: Create or Find Member Records

For each committee member, check if they already exist (by email) and create if not.

**Find existing member:**
```typescript
const criteria = { email: { $eq: email.toLowerCase() } };
const url = `${baseUrl}/api/database/member/find-one?criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
const response = await fetch(url, { headers: authHeaders(authToken) });
const data = await response.json();
const memberId = data.response?.id;
```

**Create new member:**
```typescript
const newMember = {
  userName: email.toLowerCase(),
  email: email.toLowerCase(),
  firstName,
  lastName,
  displayName: `${firstName} ${lastName}`,
  passwordResetId: generateUid(),
  expiredPassword: true,
  groupMember: true,
  committee: true,
  memberAdmin: false,
  socialAdmin: false,
  socialMember: true,
  userAdmin: false,
  walkAdmin: false,
  contentAdmin: false,
  financeAdmin: false,
  treasuryAdmin: false,
  fileAdmin: false,
  walkChangeNotifications: true,
  revoked: false,
  profileSettingsConfirmed: false,
  createdDate: dateTimeNowAsValue(),
  createdBy: "committee-setup",
  updatedDate: dateTimeNowAsValue(),
  updatedBy: "committee-setup"
};

const response = await fetch(`${baseUrl}/api/database/member`, {
  method: "POST",
  headers: authHeaders(authToken),
  body: JSON.stringify(newMember)
});
const created = await response.json();
const memberId = created.response?.id || created.id;
```

**IMPORTANT:** Cache member IDs by email so that members holding multiple roles (e.g., Chair + Walks Coordinator) are only created once.

### Step 2: Configure Committee Roles

Build the `CommitteeConfig` and POST it to the config API.

**Standard role types** (from `committee-config-template.ts`):
- `chairman` — Chairman / Group Chair
- `secretary` — Secretary / Group Secretary
- `treasurer` — Treasurer (builtInRoleMapping: `TREASURER`)
- `membership` — Membership Secretary
- `walks` — Walks Coordinator (builtInRoleMapping: `WALKS_CO_ORDINATOR`)
- `social` — Social Secretary (builtInRoleMapping: `SOCIAL_CO_ORDINATOR`)
- `publicity` — Publicity Officer
- `webmaster` — Webmaster / Web Admin
- `enquiries` — Enquiries (SYSTEM_ROLE, usually vacant)
- `support` — Support (SYSTEM_ROLE, usually mapped to webmaster)

**Custom roles** can be added with any `type` string (kebab-case). Use `RoleType.COMMITTEE_MEMBER` for committee members, `RoleType.GROUP_MEMBER` for general group roles, and `RoleType.SYSTEM_ROLE` for system roles.

**Building a CommitteeMember:**
```typescript
const role: CommitteeMember = {
  type: "chairman",
  description: "Group Chair",
  email: member.email.toLowerCase(),
  fullName: `${member.firstName} ${member.lastName}`,
  memberId: memberId,
  nameAndDescription: `${fullName} - ${description}`,
  vacant: false,
  roleType: RoleType.COMMITTEE_MEMBER,
  builtInRoleMapping: undefined  // or BuiltInRole.TREASURER etc.
};
```

**Posting committee config:**
```typescript
const committeeConfig: CommitteeConfig = {
  roles: allRoles,
  contactUs: {
    chairman: roleByType("chairman"),
    secretary: roleByType("secretary"),
    treasurer: roleByType("treasurer"),
    membership: roleByType("membership"),
    social: roleByType("social"),
    walks: roleByType("walks"),
    support: roleByType("webmaster")  // or whichever role handles support
  },
  fileTypes: [
    { description: "AGM Agenda", public: true },
    { description: "AGM Minutes", public: true },
    { description: "Committee Agenda", public: false },
    { description: "Committee Minutes", public: false },
    { description: "Annual Report", public: true },
    { description: "Financial Statement", public: false },
    { description: "Walks Programme", public: true }
  ],
  expenses: { costPerMile: DEFAULT_COST_PER_MILE }
};

await fetch(`${baseUrl}/api/database/config`, {
  method: "POST",
  headers: authHeaders(authToken),
  body: JSON.stringify({ key: "committee", value: committeeConfig })
});
```

**CRITICAL:** The `contactUs` object maps role types to `CommitteeMember` objects. These are the roles available on the contact-us page via `?contact-us&role=<type>` links. The keys MUST be: `chairman`, `secretary`, `treasurer`, `membership`, `social`, `walks`, `support`.

### Step 3: Update Contact-Us Page (Optional)

If asked to update the contact-us page, use the `update-cms-page` skill patterns. The key pattern is nested row cards with `?contact-us&role=<type>` links:

```typescript
function contactCard(title: string, emoji: string, role: string, description: string): PageContentColumn {
  return {
    columns: 4,
    rows: [{
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      marginTop: 2,
      marginBottom: 3,
      columns: [{
        columns: 12,
        accessLevel: AccessLevel.PUBLIC,
        imageBorderRadius: 6,
        showTextAfterImage: true,
        showPlaceholderImage: true,
        imageHeight: 200,
        contentText: `#### ${emoji} ${title}\n\n[${emoji} Contact ${title.split(" ")[0]}](?contact-us&role=${role}&redirect=contact-us)\n\n${description}`,
        styles: { class: "as-button" }
      }]
    }]
  };
}
```

**CRITICAL:** Contact links MUST use `?contact-us&role=<type>&redirect=<page>` query parameter syntax in TEXT rows with `styles: { class: "as-button" }`. They do NOT work as `href` in ACTION_BUTTONS rows.

**Only include roles that exist in the `contactUs` mapping** (chairman, secretary, treasurer, membership, social, walks, support). Other custom roles cannot be contacted via the contact-us form.

## Required Imports

```typescript
import { login, createOrUpdatePageContent } from "../../server/lib/shared/cms-client";
import { PageContent, PageContentType, PageContentColumn } from "../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { RoleType, BuiltInRole, CommitteeMember, CommitteeConfig, DEFAULT_COST_PER_MILE } from "../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../projects/ngx-ramblers/src/app/models/config.model";
import { dateTimeNowAsValue } from "../../server/lib/shared/dates";
import { generateUid } from "../../server/lib/shared/string-utils";
```

## Auth Helper

```typescript
function authHeaders(authToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${authToken}`,
    "Content-Type": "application/json"
  };
}
```

## Committee year pages and cover images

### Parent `/committee` shape (THE standard)

```
row 0: text — "# Committee" + short blurb
row 1: committee-documents — autoFromFirstActionButton: true, empty fileIds, showFileActions, sort desc
row 2: shared-fragment → fragments/committee-years
row 3: optional migrated-from footer
```

### Year page shape (child under the home — not the home standard itself)

```
row 0: text — "# Committee YYYY" + short welcome only (no cover image fields)
row 1: committee-documents — imageSource cover + fileIds for that year
         autoFromFirstActionButton: false, showFileActions: true, sortDirection: desc
row 2: shared-fragment → same fragments/committee-years as the parent
```

### Years index fragment (REQUIRED on parent and every year page)

Always create a dedicated page content document:

```
path: fragments/committee-years
row: album-index
  contentPath: committee, starts-with, maxPathSegments: 2
  contentTypes: ["pages"], renderModes: ["action-buttons"]
  indexMarkdown: "## Committee Years"
  sortConfig: { field: "title", direction: "desc" }
  showSwiper: true, maxColumns: 3
```

Then on the **parent** and on **each year page**, add the same shared-fragment row:

```typescript
{
  type: PageContentType.SHARED_FRAGMENT,
  maxColumns: 1,
  showSwiper: false,
  columns: [],
  fragment: { pageContentId: yearsFragmentId }
}
```

`pageContentId` is the Mongo/CMS id of `fragments/committee-years`. Create the fragment first, wire it on the home, then roll the same row into every year page after the documents row.

### Cover image location

**Only** set the year cover on the documents row:

```typescript
{
  type: PageContentType.COMMITTEE_DOCUMENTS,
  maxColumns: 1,
  showSwiper: false,
  columns: [],
  committeeDocuments: {
    fileIds: [],
    autoFromFirstActionButton: false,
    showFileActions: true,
    sortDirection: "desc",
    imageSource: "https://cdn.ramblers.org.uk/styles/xl/s3/…/photo.jpg?itok=…"
  }
}
```

Year text column is heading/welcome only — no cover image fields. The years grid card on the parent picks up `committeeDocuments.imageSource` via `findFirstImageInPage`.

### Choosing photos

- Prefer walk media from that calendar year (`groupEvent.media` xl or large)
- Different year → different photo
- HEAD-check 200 before assigning
- Empty years: `fileIds: []` only; do not invent letters/minutes

### Committee files

- Collection: `committeeFiles`
- Composed letter: `document: { title, markdown }` (no `awsFileName` required)
- Attachment: `fileNameData: { awsFileName, … }`
- `eventDate` / `createdDate` in **milliseconds**
- Year page links via `committeeDocuments.fileIds: ["<mongo id>"]`
- When restoring a deleted file, reuse the **original** `_id` if the year page still lists it
- Print letterhead always adds the site logo; if the letter markdown also starts with a logo image, the print view shows two logos — that is source content, not a placement bug

## Branding

- Use UK English ("centralised", "colour", "behaviour")
- Use "Ramblers" not "the Ramblers"
