import { keys } from "es-toolkit/compat";
import {
  ConsoleAccessLogin,
  ConsoleAccessService,
  EnvironmentConsoleAccess
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ConsoleAccessUrlIconKey } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import {
  EstateRebuildFieldLayer,
  EstateRebuildFieldSource,
  EstateRebuildPlatformFieldDefinition,
  EstateRebuildSiteFieldDefinition,
  EstateRebuildSystemScope
} from "./estate-rebuild-capture.model";

export enum ConsoleAccessFieldKind {
  LOGIN = "login",
  PASSWORD = "password",
  NOTES = "notes"
}

export interface ConsoleAccessIdentifierDefinition {
  key: string;
  label: string;
  placeholder?: string;
  shared?: boolean;
  sharedHint?: string;
}

export interface ConsoleAccessUrlTemplate {
  label: string;
  urlTemplate: string;
  iconKey?: ConsoleAccessUrlIconKey;
}

export interface ConsoleAccessResolvedUrl {
  label: string;
  url: string;
  iconKey?: ConsoleAccessUrlIconKey | null;
}

export interface ConsoleAccessServiceDefinition {
  serviceId: ConsoleAccessService;
  name: string;
  function: string;
  scope: EstateRebuildSystemScope;
  sharedCredentials?: boolean;
  identifiers: ConsoleAccessIdentifierDefinition[];
  urls: ConsoleAccessUrlTemplate[];
}

export const CONSOLE_ACCESS_SERVICES: ConsoleAccessServiceDefinition[] = [
  {
    serviceId: ConsoleAccessService.MONGODB_ATLAS,
    name: "MongoDB Atlas website",
    function: "Human login to cloud.mongodb.com for this site’s project — not the app database user. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "projectId", label: "Project ID", placeholder: "e.g. 0123456789abcdef01234567"}
    ],
    urls: [
      {
        label: "Project overview",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/overview?automateSecurity=true",
        iconKey: ConsoleAccessUrlIconKey.OVERVIEW
      },
      {
        label: "Network access list",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/security/network/accessList",
        iconKey: ConsoleAccessUrlIconKey.NETWORK
      },
      {
        label: "Database users",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/security/database/users",
        iconKey: ConsoleAccessUrlIconKey.USERS
      }
    ]
  },
  {
    serviceId: ConsoleAccessService.FLY_IO,
    name: "Fly.io website",
    function: "Human login to the fly.io dashboard for this site’s app — not the deploy API token. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "appName", label: "App name", placeholder: "e.g. ngx-ramblers-ashford"},
      {key: "organisation", label: "Organisation", placeholder: "e.g. personal"}
    ],
    urls: [
      {label: "App dashboard", urlTemplate: "https://fly.io/apps/{appName}", iconKey: ConsoleAccessUrlIconKey.DASHBOARD},
      {label: "App metrics", urlTemplate: "https://fly.io/apps/{appName}/metrics", iconKey: ConsoleAccessUrlIconKey.METRICS},
      {label: "App secrets", urlTemplate: "https://fly.io/apps/{appName}/secrets", iconKey: ConsoleAccessUrlIconKey.SECRETS},
      {label: "Organisation dashboard", urlTemplate: "https://fly.io/dashboard/{organisation}", iconKey: ConsoleAccessUrlIconKey.ORGANISATION}
    ]
  },
  {
    serviceId: ConsoleAccessService.AWS,
    name: "S3 console",
    function: "Human login to the shared AWS parent account (not the runtime IAM keys). Bucket and region are per site; account id and console login are platform shared.",
    scope: EstateRebuildSystemScope.PER_SITE,
    sharedCredentials: true,
    identifiers: [
      {
        key: "accountId",
        label: "Account ID",
        placeholder: "12-digit parent account id (once for all sites)",
        shared: true,
        sharedHint: "Same parent AWS account for every site - not missing; stored once as platform shared"
      },
      {key: "region", label: "Region", placeholder: "e.g. eu-west-2"},
      {key: "bucket", label: "S3 bucket", placeholder: "bucket name"}
    ],
    urls: [
      {label: "Console home", urlTemplate: "https://{accountId}.signin.aws.amazon.com/console", iconKey: ConsoleAccessUrlIconKey.CONSOLE},
      {label: "S3 bucket", urlTemplate: "https://s3.console.aws.amazon.com/s3/buckets/{bucket}?region={region}", iconKey: ConsoleAccessUrlIconKey.BUCKET}
    ]
  },
  {
    serviceId: ConsoleAccessService.CLOUDFLARE,
    name: "Cloudflare website",
    function: "Human login for the shared Cloudflare parent account (not the API token). Zone is per site; account id and console login are platform shared.",
    scope: EstateRebuildSystemScope.PER_SITE,
    sharedCredentials: true,
    identifiers: [
      {
        key: "accountId",
        label: "Account ID",
        placeholder: "Parent Cloudflare account id (once for all sites)",
        shared: true,
        sharedHint: "Same parent Cloudflare account for every site - not missing; stored once as platform shared"
      },
      {key: "zoneId", label: "Zone ID", placeholder: "zone id for the site domain"}
    ],
    urls: [
      {label: "Account home", urlTemplate: "https://dash.cloudflare.com/{accountId}", iconKey: ConsoleAccessUrlIconKey.ACCOUNT},
      {label: "Zone overview", urlTemplate: "https://dash.cloudflare.com/{accountId}/{zoneId}", iconKey: ConsoleAccessUrlIconKey.ZONE},
      {label: "Zone DNS", urlTemplate: "https://dash.cloudflare.com/{accountId}/{zoneId}/dns/records", iconKey: ConsoleAccessUrlIconKey.DNS}
    ]
  },
  {
    serviceId: ConsoleAccessService.BREVO,
    name: "Brevo website",
    function: "Human login to the Brevo account for this site’s sending domain and API key. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "Brevo dashboard", urlTemplate: "https://app.brevo.com/", iconKey: ConsoleAccessUrlIconKey.DASHBOARD}
    ]
  },
  {
    serviceId: ConsoleAccessService.GOOGLE_CLOUD,
    name: "Google Cloud console",
    function: "Human login for Maps, reCAPTCHA, Gmail OAuth and related GCP projects for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "projectId", label: "Project ID", placeholder: "GCP project id"}
    ],
    urls: [
      {label: "Project dashboard", urlTemplate: "https://console.cloud.google.com/home/dashboard?project={projectId}", iconKey: ConsoleAccessUrlIconKey.DASHBOARD},
      {label: "APIs & services", urlTemplate: "https://console.cloud.google.com/apis/dashboard?project={projectId}", iconKey: ConsoleAccessUrlIconKey.APIS},
      {label: "Credentials", urlTemplate: "https://console.cloud.google.com/apis/credentials?project={projectId}", iconKey: ConsoleAccessUrlIconKey.CREDENTIALS}
    ]
  },
  {
    serviceId: ConsoleAccessService.OS_DATA_HUB,
    name: "OS Data Hub console",
    function: "Human login for Ordnance Survey Data Hub for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "OS Data Hub", urlTemplate: "https://osdatahub.os.uk/", iconKey: ConsoleAccessUrlIconKey.HOME}
    ]
  },
  {
    serviceId: ConsoleAccessService.META,
    name: "Meta developer / Business console",
    function: "Human login for Facebook apps, Page roles and Instagram for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "appId", label: "App ID", placeholder: "Meta app id"}
    ],
    urls: [
      {label: "App dashboard", urlTemplate: "https://developers.facebook.com/apps/{appId}/dashboard/", iconKey: ConsoleAccessUrlIconKey.DASHBOARD},
      {label: "Business settings", urlTemplate: "https://business.facebook.com/settings", iconKey: ConsoleAccessUrlIconKey.BUSINESS}
    ]
  },
  {
    serviceId: ConsoleAccessService.MEETUP,
    name: "Meetup OAuth / account console",
    function: "Human login that can rotate Meetup OAuth credentials for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "Meetup pro admin", urlTemplate: "https://www.meetup.com/", iconKey: ConsoleAccessUrlIconKey.HOME}
    ]
  },
  {
    serviceId: ConsoleAccessService.GEMINI_AI_STUDIO,
    name: "Google AI Studio / Gemini API",
    function: "Human login for the shared Gemini API project used by NGX drafting and assisted-content features. The runtime API key is configured separately.",
    scope: EstateRebuildSystemScope.PLATFORM,
    identifiers: [],
    urls: [
      {label: "Usage", urlTemplate: "https://aistudio.google.com/usage", iconKey: ConsoleAccessUrlIconKey.METRICS},
      {label: "API keys", urlTemplate: "https://aistudio.google.com/app/apikey", iconKey: ConsoleAccessUrlIconKey.CREDENTIALS},
      {label: "Billing", urlTemplate: "https://console.cloud.google.com/billing", iconKey: ConsoleAccessUrlIconKey.ACCOUNT},
      {label: "Logs", urlTemplate: "https://aistudio.google.com/logs", iconKey: ConsoleAccessUrlIconKey.OVERVIEW}
    ]
  },
  {
    serviceId: ConsoleAccessService.DOCKER_HUB,
    name: "Docker Hub website",
    function: "Human login for the account that owns ngx-ramblers images. Shared platform account.",
    scope: EstateRebuildSystemScope.PLATFORM,
    identifiers: [
      {key: "username", label: "Username / org", placeholder: "e.g. nbarrett36"}
    ],
    urls: [
      {label: "Account / org", urlTemplate: "https://hub.docker.com/u/{username}", iconKey: ConsoleAccessUrlIconKey.ACCOUNT},
      {label: "Repositories", urlTemplate: "https://hub.docker.com/repositories/{username}", iconKey: ConsoleAccessUrlIconKey.REPOSITORIES}
    ]
  },
  {
    serviceId: ConsoleAccessService.GITHUB,
    name: "GitHub website",
    function: "Human login for the repository and Actions. Shared platform account.",
    scope: EstateRebuildSystemScope.PLATFORM,
    identifiers: [
      {key: "owner", label: "Owner", placeholder: "e.g. nbarrett"},
      {key: "repo", label: "Repository", placeholder: "e.g. ngx-ramblers"}
    ],
    urls: [
      {label: "Repository", urlTemplate: "https://github.com/{owner}/{repo}", iconKey: ConsoleAccessUrlIconKey.REPOSITORIES},
      {label: "Actions", urlTemplate: "https://github.com/{owner}/{repo}/actions", iconKey: ConsoleAccessUrlIconKey.ACTIONS},
      {label: "Secrets", urlTemplate: "https://github.com/{owner}/{repo}/settings/secrets/actions", iconKey: ConsoleAccessUrlIconKey.SECRETS}
    ]
  }
];

const FIELD_KINDS: ConsoleAccessFieldKind[] = [
  ConsoleAccessFieldKind.LOGIN,
  ConsoleAccessFieldKind.PASSWORD,
  ConsoleAccessFieldKind.NOTES
];

function fieldLabel(kind: ConsoleAccessFieldKind): string {
  if (kind === ConsoleAccessFieldKind.LOGIN) {
    return "login";
  } else if (kind === ConsoleAccessFieldKind.PASSWORD) {
    return "password";
  } else {
    return "notes";
  }
}

function isSecretKind(kind: ConsoleAccessFieldKind): boolean {
  return kind === ConsoleAccessFieldKind.PASSWORD;
}

function siteApplies(scope: EstateRebuildSystemScope): boolean {
  return scope === EstateRebuildSystemScope.PER_SITE
    || scope === EstateRebuildSystemScope.PER_SITE_AND_PLATFORM;
}

function platformApplies(scope: EstateRebuildSystemScope): boolean {
  return scope === EstateRebuildSystemScope.PLATFORM
    || scope === EstateRebuildSystemScope.PER_SITE_AND_PLATFORM;
}

function templateFullyResolved(urlTemplate: string, identifiers: Record<string, string>): string | null {
  const placeholders: string[] = urlTemplate.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  const missing = placeholders.some(token => {
    const key = token.slice(1, -1);
    return !identifiers[key];
  });
  if (missing) {
    return null;
  } else {
    return placeholders.reduce((url: string, token: string) => {
      const key = token.slice(1, -1);
      return url.split(token).join(encodeURIComponent(identifiers[key]));
    }, urlTemplate);
  }
}

export function resolveConsoleUrls(
  service: ConsoleAccessServiceDefinition,
  identifiers: Record<string, string> | undefined
): ConsoleAccessResolvedUrl[] {
  const values = identifiers || {};
  return service.urls.reduce((acc: ConsoleAccessResolvedUrl[], template) => {
    const url = templateFullyResolved(template.urlTemplate, values);
    if (url) {
      acc.push({
        label: template.label,
        url,
        iconKey: template.iconKey || null
      });
    }
    return acc;
  }, []);
}

export function consoleAccessSiteFields(): EstateRebuildSiteFieldDefinition[] {
  return CONSOLE_ACCESS_SERVICES
    .filter(service => siteApplies(service.scope))
    .flatMap(service => {
      const credentialFields = FIELD_KINDS.map(kind => ({
        fieldId: `consoleAccess.${service.serviceId}.${kind}`,
        category: `Console · ${service.name}`,
        label: `${service.name} ${fieldLabel(kind)}`,
        whereHeld: `config.environments[].consoleAccess.${service.serviceId}.${kind}`,
        source: EstateRebuildFieldSource.CONSOLE,
        layer: EstateRebuildFieldLayer.CONSOLE
      }));
      const identifierFields = service.identifiers.map(identifier => ({
        fieldId: `consoleAccess.${service.serviceId}.identifiers.${identifier.key}`,
        category: `Console · ${service.name}`,
        label: `${service.name} ${identifier.label}`,
        whereHeld: `config.environments[].consoleAccess.${service.serviceId}.identifiers.${identifier.key}`,
        source: EstateRebuildFieldSource.CONSOLE,
        layer: EstateRebuildFieldLayer.CONSOLE
      }));
      return [...credentialFields, ...identifierFields];
    });
}

export function consoleAccessPlatformFields(): EstateRebuildPlatformFieldDefinition[] {
  return CONSOLE_ACCESS_SERVICES
    .filter(service => platformApplies(service.scope))
    .flatMap(service => {
      const credentialFields = FIELD_KINDS.map(kind => ({
        fieldId: `platformConsoleAccess.${service.serviceId}.${kind}`,
        category: `Console · ${service.name}`,
        label: `${service.name} ${fieldLabel(kind)}`,
        whereHeld: `config.environments.consoleAccess.${service.serviceId}.${kind}`
      }));
      const identifierFields = service.identifiers.map(identifier => ({
        fieldId: `platformConsoleAccess.${service.serviceId}.identifiers.${identifier.key}`,
        category: `Console · ${service.name}`,
        label: `${service.name} ${identifier.label}`,
        whereHeld: `config.environments.consoleAccess.${service.serviceId}.identifiers.${identifier.key}`
      }));
      return [...credentialFields, ...identifierFields];
    });
}

export function consoleAccessValue(
  access: EnvironmentConsoleAccess | undefined,
  serviceId: ConsoleAccessService,
  kind: ConsoleAccessFieldKind
): string {
  const entry = access?.[serviceId];
  if (!entry) {
    return "";
  } else if (kind === ConsoleAccessFieldKind.LOGIN) {
    return entry.login || "";
  } else if (kind === ConsoleAccessFieldKind.PASSWORD) {
    return entry.password || "";
  } else {
    return entry.notes || "";
  }
}

export function consoleAccessIdentifierValue(
  access: EnvironmentConsoleAccess | undefined,
  serviceId: ConsoleAccessService,
  identifierKey: string
): string {
  return access?.[serviceId]?.identifiers?.[identifierKey] || "";
}

export function isConsoleAccessPasswordField(fieldId: string): boolean {
  return fieldId.endsWith(`.${ConsoleAccessFieldKind.PASSWORD}`);
}

export function loginHasContent(entry: ConsoleAccessLogin | undefined): boolean {
  if (!entry) {
    return false;
  } else {
    const identifierKeys = entry.identifiers ? keys(entry.identifiers) : [];
    const hasIdentifiers = identifierKeys.some(key => !!entry.identifiers[key]);
    return !!(entry.login || entry.password || entry.notes || hasIdentifiers);
  }
}

export { isSecretKind };
