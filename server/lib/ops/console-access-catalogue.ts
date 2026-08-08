import { keys } from "es-toolkit/compat";
import {
  ConsoleAccessLogin,
  ConsoleAccessService,
  EnvironmentConsoleAccess
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
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
}

export interface ConsoleAccessUrlTemplate {
  label: string;
  urlTemplate: string;
}

export interface ConsoleAccessResolvedUrl {
  label: string;
  url: string;
}

export interface ConsoleAccessServiceDefinition {
  serviceId: ConsoleAccessService;
  name: string;
  function: string;
  scope: EstateRebuildSystemScope;
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
      {key: "projectId", label: "Project ID", placeholder: "e.g. 6a27f45d4ff20306f5b4efb0"}
    ],
    urls: [
      {
        label: "Project overview",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/overview?automateSecurity=true"
      },
      {
        label: "Network access list",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/security/network/accessList"
      },
      {
        label: "Database users",
        urlTemplate: "https://cloud.mongodb.com/v2/{projectId}#/security/database/users"
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
      {label: "App dashboard", urlTemplate: "https://fly.io/apps/{appName}"},
      {label: "App metrics", urlTemplate: "https://fly.io/apps/{appName}/metrics"},
      {label: "App secrets", urlTemplate: "https://fly.io/apps/{appName}/secrets"},
      {label: "Organisation dashboard", urlTemplate: "https://fly.io/dashboard/{organisation}"}
    ]
  },
  {
    serviceId: ConsoleAccessService.AWS,
    name: "AWS console",
    function: "Human login to the AWS account used for this site’s bucket — not the runtime IAM keys. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "accountId", label: "Account ID", placeholder: "12-digit account id"},
      {key: "region", label: "Region", placeholder: "e.g. eu-west-2"},
      {key: "bucket", label: "S3 bucket", placeholder: "bucket name"}
    ],
    urls: [
      {label: "Console home", urlTemplate: "https://{accountId}.signin.aws.amazon.com/console"},
      {label: "S3 bucket", urlTemplate: "https://s3.console.aws.amazon.com/s3/buckets/{bucket}?region={region}"}
    ]
  },
  {
    serviceId: ConsoleAccessService.CLOUDFLARE,
    name: "Cloudflare website",
    function: "Human login for DNS and zones for this site — not the API token. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [
      {key: "accountId", label: "Account ID", placeholder: "Cloudflare account id"},
      {key: "zoneId", label: "Zone ID", placeholder: "zone id for the site domain"}
    ],
    urls: [
      {label: "Account home", urlTemplate: "https://dash.cloudflare.com/{accountId}"},
      {label: "Zone overview", urlTemplate: "https://dash.cloudflare.com/{accountId}/{zoneId}"},
      {label: "Zone DNS", urlTemplate: "https://dash.cloudflare.com/{accountId}/{zoneId}/dns/records"}
    ]
  },
  {
    serviceId: ConsoleAccessService.BREVO,
    name: "Brevo website",
    function: "Human login to the Brevo account for this site’s sending domain and API key. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "Brevo dashboard", urlTemplate: "https://app.brevo.com/"}
    ]
  },
  {
    serviceId: ConsoleAccessService.MAILCHIMP,
    name: "Mailchimp website",
    function: "Human login where Mailchimp is still used for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "Mailchimp dashboard", urlTemplate: "https://admin.mailchimp.com/"}
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
      {label: "Project dashboard", urlTemplate: "https://console.cloud.google.com/home/dashboard?project={projectId}"},
      {label: "APIs & services", urlTemplate: "https://console.cloud.google.com/apis/dashboard?project={projectId}"},
      {label: "Credentials", urlTemplate: "https://console.cloud.google.com/apis/credentials?project={projectId}"}
    ]
  },
  {
    serviceId: ConsoleAccessService.OS_DATA_HUB,
    name: "OS Data Hub console",
    function: "Human login for Ordnance Survey Data Hub for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "OS Data Hub", urlTemplate: "https://osdatahub.os.uk/"}
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
      {label: "App dashboard", urlTemplate: "https://developers.facebook.com/apps/{appId}/dashboard/"},
      {label: "Business settings", urlTemplate: "https://business.facebook.com/settings"}
    ]
  },
  {
    serviceId: ConsoleAccessService.MEETUP,
    name: "Meetup OAuth / account console",
    function: "Human login that can rotate Meetup OAuth credentials for this site. Per environment.",
    scope: EstateRebuildSystemScope.PER_SITE,
    identifiers: [],
    urls: [
      {label: "Meetup pro admin", urlTemplate: "https://www.meetup.com/"}
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
      {label: "Account / org", urlTemplate: "https://hub.docker.com/u/{username}"},
      {label: "Repositories", urlTemplate: "https://hub.docker.com/repositories/{username}"}
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
      {label: "Repository", urlTemplate: "https://github.com/{owner}/{repo}"},
      {label: "Actions", urlTemplate: "https://github.com/{owner}/{repo}/actions"},
      {label: "Secrets", urlTemplate: "https://github.com/{owner}/{repo}/settings/secrets/actions"}
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
  return service.urls
    .map(template => {
      const url = templateFullyResolved(template.urlTemplate, values);
      if (!url) {
        return null;
      } else {
        return {label: template.label, url};
      }
    })
    .filter((item): item is ConsoleAccessResolvedUrl => item !== null);
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

export function consoleAccessServiceById(serviceId: string): ConsoleAccessServiceDefinition | null {
  return CONSOLE_ACCESS_SERVICES.find(service => service.serviceId === serviceId) || null;
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
