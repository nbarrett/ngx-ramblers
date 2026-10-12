import { WALKS_HOW_TO_DOCUMENTATION_URL } from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";
import { PageContent, PageContentRow, PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { FilterCriteria, SortOrder } from "../../../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { liteHomePageContent } from "../../../../../projects/ngx-ramblers/src/app/models/home-content.model";
import { dateTimeNow } from "../../../shared/dates";
import { DateRangeMode } from "../../../../../projects/ngx-ramblers/src/app/models/group-events.model";
import { RegistrationNavbarPath } from "../../../../../projects/ngx-ramblers/src/app/models/site-registration.model";

export interface PageContentTemplateParams {
  groupName: string;
  groupShortName: string;
  ngxLite?: boolean;
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

function createEventsRow(eventType: RamblersEventType, viewSelector: boolean): PageContentRow {
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
        viewSelector,
        allowFilterChange: true,
        allowSortChange: true
      },
      eventTypes: [eventType],
      fromDate: dateTimeNow().toMillis(),
      toDate: dateTimeNow().plus({years: 1}).toMillis(),
      filterCriteria: FilterCriteria.FUTURE_EVENTS,
      sortOrder: SortOrder.DATE_ASCENDING,
      dateRangeMode: DateRangeMode.DATE_PICKERS
    }
  };
}

export function createWalksPage(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks",
    rows: [
      createTextRow("# Walks Programme"),
      createEventsRow(RamblersEventType.GROUP_WALK, true),
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

export function createGroupEventsPage(): PageContent {
  return {
    path: RegistrationNavbarPath.EVENTS,
    rows: [
      createTextRow("# Social Events"),
      createEventsRow(RamblersEventType.GROUP_EVENT, false)
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

export function createAdminActionButtons(_params: PageContentTemplateParams): PageContent {
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
export const WALKING_APP_HOWTO_PATH = "how-to/walking-app";
export const WALKING_APP_HOWTO_URL = new URL("/how-to/walking-app", WALKS_HOW_TO_DOCUMENTATION_URL).href;

export function privacyPolicyMarkdown(params: PageContentTemplateParams): string {
  return `# Privacy Policy for ${params.groupName}

This Privacy Policy explains what ${params.groupName} stores on your device, what data is collected, and how it is used. It covers this website and the NGX-Ramblers walking app when that app is connected to this website. Questions about this policy can be sent through the [Contact Us](/contact-us) page.

## What we store on your device

### Browser local storage

This site uses browser localStorage (similar to cookies) to store:

- **Authentication tokens** — When you log in as a member, a token is stored so your session continues. The token can contain your member identifier and permissions, so it is personal information.
- **Display preferences** — Choices such as map zoom, search filters, sort order and view mode are remembered so you do not have to set them again on each visit.

This storage supports sign-in and the settings you choose. Tokens and preferences stay on your device until they expire or you remove them through the application or browser settings.

## Optional website analytics

Analytics is optional. Most group websites do not enable it. A site may have no analytics at all.

Where Google Analytics is enabled, its scripts and cookies measure website use. Where Cloudflare Web Analytics is enabled, a cookieless request reports page views. Neither is switched on just because this platform can support it.

The walking app does not start either analytics service. Embedded content or links opened outside the app follow the provider's own privacy notice.

This website does not use advertising cookies, behavioural tracking cookies, social-media tracking cookies or third-party tracking pixels.

## Third-party services

This site uses:

- **Font Awesome** — icons included with the application
- **Cloudflare** — DNS and content delivery (may set a \`__cf_bm\` cookie for security)

${params.groupName} does not control cookies set by those services.

## Children's information

${params.groupName} does not knowingly collect personal information from children under 13. If you believe a child has given us this kind of information, contact us and we will remove it.

## Walking app

The NGX-Ramblers walking app for iPhone and Android can connect to this website. This group's privacy policy applies to the member account and to information held here. The [walking app how-to](${WALKING_APP_HOWTO_URL}) explains how to choose a group and use maps and recordings.

### Location and recorded walks

The app uses your precise location to show your position on a map, follow a route and record a walk. If you allow background location, a recording can continue with the screen locked or while you use another app. You control this permission in your phone's settings and can pause or stop recording in the app.

Recorded points, including coordinates, timestamps and available elevation, stay on your device for recording and recovery. Saving a recording sends its route, title, description and any waypoints to this website. A saved route may be visible to other people according to the route's visibility and this group's permissions. Check the visibility before saving a route that shows a private address or other sensitive location.

Removing an offline copy or hiding a route changes your own device or route list. It does not delete the route from this website.

### Accounts and preferences

Signing in uses your existing account on this website. The app processes your account identifier, name and email address for sign-in and member features. Authentication tokens and necessary app settings are stored on your device. Uploaded routes can be associated with the member who created or updated them. Favourites and hidden routes are stored locally; where profile synchronisation is available, those choices are associated with your member account here.

The app does not access your phone's address book, microphone, health records or advertising identifier. It does not use advertising or cross-app advertising tracking.

### Maps and network services

Displaying maps, downloading offline maps, finding nearby routes and calculating directions can send requests to this website and its mapping providers. Those services receive the network information needed to respond, such as an IP address and requested map area; route calculation can include coordinates. Their own privacy notices apply. Saved routes and member records are held by this website and its hosting and storage providers.

### Retention and your choices

Offline maps, recordings and app settings remain on your device until removed through the app or your device settings. Removing the app does not remove data you have already uploaded. Website records are retained under this group's usual arrangements, including backups.

You can withdraw location permission, stop recording, sign out and remove local offline copies. For access, correction or deletion of your member account or uploaded routes, use [Contact Us](/contact-us). For a problem with the app itself, use [Website Support on the NGX-Ramblers Contact Us page](https://www.ngx-ramblers.org.uk/contact-us). Do not include passwords or a full location history in an initial support request.

## Further reading

For a detailed technical explanation of how this platform handles privacy, cookies and PECR, see [Privacy, Cookies and PECR Compliance](https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-04-04-privacy-cookies-and-compliance).

## Permissions and consent

This policy explains how information is handled. Where a feature needs permission or consent, that is requested separately. Reading or using the website is not treated as blanket consent.`;
}

export function createPrivacyPolicyPage(params: PageContentTemplateParams): PageContent {
  return {
    path: PRIVACY_POLICY_PATH,
    rows: [
      createTextRow(privacyPolicyMarkdown(params))
    ]
  };
}

export function createAllSamplePageContent(params: PageContentTemplateParams): PageContent[] {
  if (params.ngxLite) {
    return [
      liteHomePageContent(params.groupName),
      createContactUsPageContent(params),
      createAboutUsPageContent(params),
      createAdminActionButtons(params),
      createPrivacyPolicyPage(params)
    ];
  }
  return [
    createHomeContent(params),
    createWalksPage(params),
    createGroupEventsPage(),
    createWalksInformation(params),
    createContactUsPageContent(params),
    createAboutUsPageContent(params),
    createAdminActionButtons(params),
    createPrivacyPolicyPage(params)
  ];
}

export const INCORRECT_PATHS_TO_CLEANUP = ["walks", "admin", "home"];
