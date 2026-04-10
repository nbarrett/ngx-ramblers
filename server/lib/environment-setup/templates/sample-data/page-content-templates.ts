import { PageContent, PageContentRow, PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { FilterCriteria, SortOrder } from "../../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNow } from "../../../shared/dates";

export interface PageContentTemplateParams {
  groupName: string;
  groupShortName: string;
}

function createTextRow(contentText: string, columns: number = 12): PageContentRow {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 12,
    columns: [
      {
        columns,
        accessLevel: AccessLevel.PUBLIC,
        contentText
      }
    ]
  };
}

export function createHomeContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "#home-content",
    rows: [
      createTextRow(`## Welcome to the ${params.groupName} Website\n\nWe are a friendly group offering walks in the local area. We usually meet on Sundays and offer a variety of walks.\n\nWalks are advertised on this site and on the Ramblers App.\n\nWe operate a "try before you buy" policy - you're welcome to join us for a few walks before deciding whether to become a member.\n\nWell-behaved dogs welcome!`)
    ]
  };
}

function createEventsRow(): PageContentRow {
  return {
    type: PageContentType.EVENTS,
    showSwiper: false,
    maxColumns: 2,
    columns: [],
    events: {
      minColumns: 2,
      maxColumns: 2,
      allow: {
        addNew: true,
        pagination: true,
        quickSearch: true,
        alert: true,
        autoTitle: true,
        advancedSearch: true,
        viewSelector: true
      },
      eventTypes: [RamblersEventType.GROUP_WALK],
      fromDate: dateTimeNow().toMillis(),
      toDate: dateTimeNow().plus({years: 1}).toMillis(),
      filterCriteria: FilterCriteria.FUTURE_EVENTS,
      sortOrder: SortOrder.DATE_ASCENDING
    }
  };
}

export function createWalksPage(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks",
    rows: [
      createTextRow("# Walks Programme"),
      createEventsRow(),
      {
        type: PageContentType.ACTION_BUTTONS,
        showSwiper: false,
        maxColumns: 2,
        columns: [
          {
            columns: 6,
            title: "Walks Information",
            href: "walks/information",
            accessLevel: AccessLevel.PUBLIC,
            contentText: "More information about our walks",
            showPlaceholderImage: true
          },
          {
            columns: 6,
            title: "Admin",
            href: "walks/admin",
            accessLevel: AccessLevel.COMMITTEE,
            contentText: "Walk administration and settings",
            showPlaceholderImage: true
          }
        ]
      }
    ]
  };
}

export function createWalksInformation(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks/information",
    rows: [
      createTextRow(`# Walks Information\n\n## Before you join a walk make sure that...\n\n- You have suitable footwear and clothing for the terrain and the weather\n- You have sufficient water and food with you\n- You are comfortable with the length/distance of the walk\n- You are familiar with the safety information on the [Ramblers website](https://www.ramblers.org.uk/go-walking-hub/safety)`)
    ]
  };
}

export function createContactUsPageContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "contact-us",
    rows: [
      createTextRow(`# Contact Us\n\nFor general enquiries about ${params.groupName}, please email us.\n\nIf you have a question about a specific walk on our programme, please contact the walk leader directly.`)
    ]
  };
}

export function createAboutUsPageContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "about-us",
    rows: [
      createTextRow(`# Join Us!\n\n## On the day\n\nYou can just turn up on the day. We do set off promptly at the start time, so please try to be there at least 10-15 minutes early.\n\nIt is advisable to carry a drink and a snack, and on longer walks bring a picnic.\n\n## How to join\n\nYou can join online via the [Ramblers website](https://www.ramblers.org.uk/membership).\n\nEnter your "Ramblers Group" as "${params.groupName}", and you'll be made a member of our group.`)
    ]
  };
}

export function createAdminActionButtons(params: PageContentTemplateParams): PageContent {
  return {
    path: "admin#action-buttons",
    rows: [
      {
        type: PageContentType.ACTION_BUTTONS,
        showSwiper: false,
        maxColumns: 3,
        columns: []
      }
    ]
  };
}

export const PRIVACY_POLICY_PATH = "about-us/privacy-policy";

export function createPrivacyPolicyPage(params: PageContentTemplateParams): PageContent {
  return {
    path: PRIVACY_POLICY_PATH,
    rows: [
      createTextRow(`# Privacy Policy for ${params.groupName}

At ${params.groupName}, one of our main priorities is the privacy of our visitors. This Privacy Policy explains what information is stored on your device, what data we collect, and how we use it.

If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.

## What We Store on Your Device

### Browser Local Storage

This site uses browser localStorage (a mechanism similar to cookies) to store:

- **Authentication tokens (JWTs)** — When you log in as a member, a JSON Web Token is stored to maintain your session. This is essential for the login function to work.
- **Display preferences** — If you change settings such as map zoom level, search filters, sort orders, or view modes, these choices are remembered so you don't have to set them again on each visit.

This storage is **strictly necessary** for the provision of features you have explicitly requested, and qualifies for the exemption under PECR Regulation 6(4). No consent mechanism is required for this type of storage.

No personal data, analytics identifiers, or tracking information is stored in your browser's local storage.

## Analytics

If analytics have been configured for this site, it may use one of the following:

- **Google Analytics** — sets cookies (\`_ga\`, \`_ga_*\`, \`_gid\`) to collect anonymous usage statistics. These cookies are set by Google, not by ${params.groupName} directly.
- **Cloudflare Web Analytics** — a cookieless analytics solution that collects anonymous page view statistics without storing anything on your device.

### What We Do NOT Use

- No advertising or behavioural tracking cookies
- No third-party tracking pixels
- No social media tracking cookies
- No web beacons

## Third Party Services

This site uses the following third-party services:

- **Font Awesome** — for displaying icons (loaded from a CDN, sets no cookies)
- **Cloudflare** — for DNS and content delivery (may set a \`__cf_bm\` cookie for security purposes)

${params.groupName} has no access to or control over cookies set by third-party services.

## Children's Information

${params.groupName} does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.

## Online Privacy Policy Only

This Privacy Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collected by ${params.groupName}. This policy is not applicable to any information collected offline or via channels other than this website.

## Further Reading

For a detailed technical explanation of how this platform handles privacy, cookies, and PECR compliance, see the [Privacy, Cookies and PECR Compliance](https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-04-04-privacy-cookies-and-compliance) technical article.

## Consent

By using our website, you hereby consent to our Privacy Policy and agree to its Terms and Conditions.`)
    ]
  };
}

export function createAllSamplePageContent(params: PageContentTemplateParams): PageContent[] {
  return [
    createHomeContent(params),
    createWalksPage(params),
    createWalksInformation(params),
    createContactUsPageContent(params),
    createAboutUsPageContent(params),
    createAdminActionButtons(params),
    createPrivacyPolicyPage(params)
  ];
}

export const INCORRECT_PATHS_TO_CLEANUP = ["walks", "admin", "home", "committee"];
