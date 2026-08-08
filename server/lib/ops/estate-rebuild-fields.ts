import {
  EstateRebuildFieldLayer,
  EstateRebuildFieldSource,
  EstateRebuildPlatformFieldDefinition,
  EstateRebuildSiteFieldDefinition,
  EstateRebuildSystemScope,
  EstateRebuildThirdPartySystem
} from "./estate-rebuild-capture.model";
import { consoleAccessPlatformFields, consoleAccessSiteFields } from "./console-access-catalogue";

const S = EstateRebuildFieldSource;
const L = EstateRebuildFieldLayer;

const SITE_RUNTIME_AND_APP_FIELDS: EstateRebuildSiteFieldDefinition[] = [
  {fieldId: "environment", category: "Identity", label: "Environment key", whereHeld: "config.environments[].environment", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "groupLongName", category: "Identity", label: "Group long name", whereHeld: "system.group.longName", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "groupCode", category: "Identity", label: "Group code", whereHeld: "system.group.groupCode", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "areaCode", category: "Identity", label: "Area code", whereHeld: "system.area.groupCode", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "siteHref", category: "Identity", label: "Primary public site URL", whereHeld: "system.group.href", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "flyAppName", category: "Identity", label: "Fly app name", whereHeld: "config.environments[].flyio.appName", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "customDomains", category: "Identity", label: "Custom domains", whereHeld: "config.environments[].customDomains", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "mailProvider", category: "Identity", label: "Mail provider", whereHeld: "system.mailDefaults.mailProvider", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "ngxLite", category: "Identity", label: "ngxLite", whereHeld: "config.environments[].ngxLite", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "mongoCluster", category: "MongoDB", label: "Cluster hostname prefix", whereHeld: "config.environments[].mongo.cluster", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "mongoDb", category: "MongoDB", label: "Database name", whereHeld: "config.environments[].mongo.db", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "mongoUsername", category: "MongoDB", label: "Database username", whereHeld: "config.environments[].mongo.username", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "mongoPassword", category: "MongoDB", label: "Database password", whereHeld: "config.environments[].mongo.password", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "awsBucket", category: "AWS S3", label: "S3 bucket name", whereHeld: "config.environments[].aws.bucket", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "awsRegion", category: "AWS S3", label: "S3 region", whereHeld: "config.environments[].aws.region", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "awsAccessKeyId", category: "AWS S3", label: "IAM access key ID", whereHeld: "config.environments[].aws.accessKeyId", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "awsSecretAccessKey", category: "AWS S3", label: "IAM secret access key", whereHeld: "config.environments[].aws.secretAccessKey", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "flyOrganisation", category: "Fly.io", label: "Fly organisation", whereHeld: "config.environments[].flyio.organisation", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "flyApiToken", category: "Fly.io", label: "Fly API token", whereHeld: "config.environments[].flyio.apiKey", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "flyMemory", category: "Fly.io", label: "Machine memory", whereHeld: "config.environments[].flyio.memory", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "flyScaleCount", category: "Fly.io", label: "Scale count", whereHeld: "config.environments[].flyio.scaleCount", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "cloudflareZoneId", category: "Cloudflare", label: "Cloudflare zone ID", whereHeld: "config.environments[].cloudflare.zoneId", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "cloudflareAccountId", category: "Cloudflare", label: "Cloudflare account ID", whereHeld: "config.environments[].cloudflare.accountId", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "cloudflareApiToken", category: "Cloudflare", label: "Cloudflare API token", whereHeld: "config.environments[].cloudflare.apiToken", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "authSecret", category: "App secrets", label: "AUTH_SECRET", whereHeld: "config.environments[].secrets.AUTH_SECRET", source: S.INFRA, layer: L.RUNTIME},
  {fieldId: "secretKeys", category: "App secrets", label: "Secret key names", whereHeld: "config.environments[].secrets", source: S.INFRA, layer: L.RUNTIME},

  {fieldId: "googleMapsApiKey", category: "Maps & captcha", label: "Google Maps API key", whereHeld: "system.googleMaps.apiKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "osMapsApiKey", category: "Maps & captcha", label: "OS Maps API key", whereHeld: "system.externalSystems.osMaps.apiKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "recaptchaSiteKey", category: "Maps & captcha", label: "reCAPTCHA site key", whereHeld: "system.recaptcha.siteKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "recaptchaSecretKey", category: "Maps & captcha", label: "reCAPTCHA secret key", whereHeld: "system.recaptcha.secretKey", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "brevoApiKey", category: "Email", label: "Brevo API key", whereHeld: "config.brevo.apiKey", source: S.BREVO, layer: L.APPLICATION},

  {fieldId: "wmApiKey", category: "Walks Manager", label: "Walks Manager API key", whereHeld: "system.national.walksManager.apiKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "wmUsername", category: "Walks Manager", label: "Walks Manager username", whereHeld: "system.national.walksManager.userName", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "wmPassword", category: "Walks Manager", label: "Walks Manager password", whereHeld: "system.national.walksManager.password", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "facebookAppId", category: "Facebook / Instagram", label: "Facebook App ID", whereHeld: "system.externalSystems.facebook.appId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "facebookAppSecret", category: "Facebook / Instagram", label: "Facebook App Secret", whereHeld: "system.externalSystems.facebook.appSecret", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "facebookPageId", category: "Facebook / Instagram", label: "Facebook Page ID", whereHeld: "system.externalSystems.facebook.pageId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "facebookPageAccessToken", category: "Facebook / Instagram", label: "Facebook Page access token", whereHeld: "system.externalSystems.facebook.pageAccessToken", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "facebookPagesUrl", category: "Facebook / Instagram", label: "Facebook Page URL", whereHeld: "system.externalSystems.facebook.pagesUrl", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "facebookPublishingEnabled", category: "Facebook / Instagram", label: "Facebook publishing enabled", whereHeld: "system.externalSystems.facebook.publishingEnabled", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "instagramUserId", category: "Facebook / Instagram", label: "Instagram user id", whereHeld: "system.externalSystems.instagram.igUserId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "instagramGroupName", category: "Facebook / Instagram", label: "Instagram group name", whereHeld: "system.externalSystems.instagram.groupName", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "meetupClientId", category: "Meetup", label: "Meetup OAuth client ID", whereHeld: "system.externalSystems.meetup.clientId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "meetupClientSecret", category: "Meetup", label: "Meetup OAuth client secret", whereHeld: "system.externalSystems.meetup.clientSecret", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "meetupAccessToken", category: "Meetup", label: "Meetup access token", whereHeld: "system.externalSystems.meetup.accessToken", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "meetupRefreshToken", category: "Meetup", label: "Meetup refresh token", whereHeld: "system.externalSystems.meetup.refreshToken", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "meetupApiKey", category: "Meetup", label: "Meetup API key", whereHeld: "system.externalSystems.meetup.apiKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "meetupGroupName", category: "Meetup", label: "Meetup group name", whereHeld: "system.externalSystems.meetup.groupName", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "salesforceEnabled", category: "Salesforce", label: "Salesforce enabled", whereHeld: "config.salesforce.enabled", source: S.SALESFORCE, layer: L.APPLICATION},
  {fieldId: "salesforceEndpoint", category: "Salesforce", label: "Salesforce endpoint base URL", whereHeld: "config.salesforce.endpointBaseUrl", source: S.SALESFORCE, layer: L.APPLICATION},
  {fieldId: "salesforceApiKeys", category: "Salesforce", label: "Salesforce API keys by group code", whereHeld: "config.salesforce.apiKeysByGroupCode", source: S.SALESFORCE, layer: L.APPLICATION},

  {fieldId: "googleAnalyticsId", category: "Analytics & search", label: "Google Analytics tracking ID", whereHeld: "system.googleAnalytics.trackingId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "cloudflareWebAnalyticsToken", category: "Analytics & search", label: "Cloudflare Web Analytics site token", whereHeld: "system.cloudflareWebAnalytics.siteToken", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "googleSearchConsoleVerification", category: "Analytics & search", label: "Search Console verification ID", whereHeld: "system.googleSearchConsole.verificationId", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "gmailClientId", category: "Committee inbox & push", label: "Gmail OAuth client ID", whereHeld: "system.googleInbox.clientId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "gmailClientSecret", category: "Committee inbox & push", label: "Gmail OAuth client secret", whereHeld: "system.googleInbox.clientSecret", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "gmailRedirectUri", category: "Committee inbox & push", label: "Gmail OAuth redirect URI", whereHeld: "system.googleInbox.redirectUri", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "gmailPubsubProject", category: "Committee inbox & push", label: "Gmail Pub/Sub project id", whereHeld: "system.googleInbox.pubsubProjectId", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "vapidPublicKey", category: "Committee inbox & push", label: "Web Push VAPID public key", whereHeld: "system.inboxPush.vapidPublicKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "vapidPrivateKey", category: "Committee inbox & push", label: "Web Push VAPID private key", whereHeld: "system.inboxPush.vapidPrivateKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "vapidSubject", category: "Committee inbox & push", label: "Web Push VAPID subject", whereHeld: "system.inboxPush.vapidSubject", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "flickrApiKey", category: "Other social", label: "Flickr API key", whereHeld: "system.externalSystems.flickr.apiKey", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "youtubeUrl", category: "Other social", label: "YouTube channel URL", whereHeld: "system.externalSystems.youtube.groupUrl", source: S.SYSTEM, layer: L.APPLICATION},
  {fieldId: "twitterUrl", category: "Other social", label: "X/Twitter URL", whereHeld: "system.externalSystems.twitter.groupUrl", source: S.SYSTEM, layer: L.APPLICATION},

  {fieldId: "chairmanRoleType", category: "People", label: "Chairman role type", whereHeld: "committee.roles / committee.contactUs.chairman", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "chairmanName", category: "People", label: "Chairman name", whereHeld: "committee.roles / committee.contactUs.chairman", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "chairmanEmail", category: "People", label: "Chairman email", whereHeld: "committee.roles / committee.contactUs.chairman", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "webmasterRoleType", category: "People", label: "Webmaster role type", whereHeld: "committee.roles", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "webmasterName", category: "People", label: "Webmaster name", whereHeld: "committee.roles", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "webmasterEmail", category: "People", label: "Webmaster email", whereHeld: "committee.roles", source: S.COMMITTEE, layer: L.PEOPLE},
  {fieldId: "siteContactsSummary", category: "People", label: "Site contacts summary", whereHeld: "committee.roles (derived)", source: S.COMMITTEE, layer: L.PEOPLE}
];

export const SITE_FIELDS: EstateRebuildSiteFieldDefinition[] = [
  ...SITE_RUNTIME_AND_APP_FIELDS,
  ...consoleAccessSiteFields()
];

const PLATFORM_CORE_FIELDS: EstateRebuildPlatformFieldDefinition[] = [
  {fieldId: "autoDeployTarget", category: "Platform", label: "autoDeployTarget", whereHeld: "config.environments.autoDeployTarget"},
  {fieldId: "dockerImage", category: "Platform", label: "dockerImage", whereHeld: "config.environments.dockerImage"},
  {fieldId: "region", category: "Platform", label: "Deploy region", whereHeld: "config.environments.region"},
  {fieldId: "globalAwsBucket", category: "Shared AWS", label: "Global AWS bucket", whereHeld: "config.environments.aws.bucket"},
  {fieldId: "globalAwsRegion", category: "Shared AWS", label: "Global AWS region", whereHeld: "config.environments.aws.region"},
  {fieldId: "globalAwsAccessKeyId", category: "Shared AWS", label: "Global AWS access key ID", whereHeld: "config.environments.aws.accessKeyId"},
  {fieldId: "globalAwsSecretAccessKey", category: "Shared AWS", label: "Global AWS secret access key", whereHeld: "config.environments.aws.secretAccessKey"},
  {fieldId: "globalCloudflareAccountId", category: "Shared Cloudflare", label: "Global Cloudflare account ID", whereHeld: "config.environments.cloudflare.accountId"},
  {fieldId: "globalCloudflareApiToken", category: "Shared Cloudflare", label: "Global Cloudflare API token", whereHeld: "config.environments.cloudflare.apiToken"},
  {fieldId: "globalCloudflareZoneId", category: "Shared Cloudflare", label: "Global Cloudflare zone ID", whereHeld: "config.environments.cloudflare.zoneId"},
  {fieldId: "globalCloudflareBaseDomain", category: "Shared Cloudflare", label: "Global Cloudflare base domain", whereHeld: "config.environments.cloudflare.baseDomain"},
  {fieldId: "globalSecretsKeys", category: "Platform secrets", label: "Global secret key names", whereHeld: "config.environments.secrets"},
  {fieldId: "aiEnabled", category: "AI", label: "AI enabled", whereHeld: "config.environments.ai.enabled"},
  {fieldId: "aiProvider", category: "AI", label: "AI provider", whereHeld: "config.environments.ai.provider"},
  {fieldId: "aiBaseUrl", category: "AI", label: "AI base URL", whereHeld: "config.environments.ai.baseUrl"},
  {fieldId: "aiModel", category: "AI", label: "AI model", whereHeld: "config.environments.ai.model"},
  {fieldId: "aiApiKey", category: "AI", label: "AI API key", whereHeld: "config.environments.ai.apiKey"},
  {fieldId: "workerAppName", category: "Integration worker", label: "Worker Fly app name", whereHeld: "config.environments.uploadWorker.appName"},
  {fieldId: "workerApiKey", category: "Integration worker", label: "Worker Fly API token", whereHeld: "config.environments.uploadWorker.apiKey"},
  {fieldId: "workerSharedSecret", category: "Integration worker", label: "Worker shared secret", whereHeld: "config.environments.uploadWorker.sharedSecret"},
  {fieldId: "workerEncryptionKey", category: "Integration worker", label: "Worker encryption key", whereHeld: "config.environments.uploadWorker.encryptionKey"},
  {fieldId: "workerMemory", category: "Integration worker", label: "Worker memory", whereHeld: "config.environments.uploadWorker.memory"},
  {fieldId: "workerScaleCount", category: "Integration worker", label: "Worker scale count", whereHeld: "config.environments.uploadWorker.scaleCount"}
];

export const PLATFORM_FIELDS: EstateRebuildPlatformFieldDefinition[] = [
  ...PLATFORM_CORE_FIELDS,
  ...consoleAccessPlatformFields()
];

export const THIRD_PARTY_SYSTEMS: EstateRebuildThirdPartySystem[] = [
  {
    systemId: "mongodbAtlas",
    name: "MongoDB Atlas",
    function: "Primary application database for every site (members, walks, CMS content, config documents).",
    informationHeld: "Runtime: cluster, database name, app DB user and password. System login: per-environment Atlas website login under consoleAccess (not the app DB user).",
    configPaths: "config.environments[].mongo.*, config.environments[].consoleAccess.mongodbAtlas.*",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "awsS3",
    name: "S3",
    function: "Object storage for site media, logos, album images, and other uploaded assets.",
    informationHeld: "Runtime IAM keys and bucket. System login: per-environment AWS website login under consoleAccess.",
    configPaths: "config.environments[].aws.*, config.environments.aws.*, config.environments[].consoleAccess.aws.*",
    scope: EstateRebuildSystemScope.PER_SITE_AND_PLATFORM
  },
  {
    systemId: "flyIo",
    name: "Fly.io",
    function: "Hosts each site process and the integration worker; receives deploys and holds runtime secrets on the machine.",
    informationHeld: "Runtime deploy API token and app settings. System login: per-environment fly.io website login under consoleAccess (not the API token).",
    configPaths: "config.environments[].flyio.*, config.environments.uploadWorker.*, config.environments[].consoleAccess.flyIo.*",
    scope: EstateRebuildSystemScope.PER_SITE_AND_PLATFORM
  },
  {
    systemId: "cloudflare",
    name: "Cloudflare",
    function: "DNS and zone control for platform and custom domains; optional Web Analytics beacon tokens.",
    informationHeld: "Account ID, API token, zone ID, base domain (global); per-site zone/account/token overrides; Web Analytics site token in system config.",
    configPaths: "config.environments.cloudflare.*, config.environments[].cloudflare.*, system.cloudflareWebAnalytics.siteToken",
    scope: EstateRebuildSystemScope.PER_SITE_AND_PLATFORM
  },
  {
    systemId: "googleMaps",
    name: "Google Maps Platform",
    function: "Maps, places, and related map UI used by walks and venues.",
    informationHeld: "Maps / Places API key in each site system config.",
    configPaths: "system.googleMaps.apiKey",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "osDataHub",
    name: "OS Data Hub (OS Maps)",
    function: "Ordnance Survey map tiles and related mapping for UK walks.",
    informationHeld: "OS Maps API key in each site system config.",
    configPaths: "system.externalSystems.osMaps.apiKey",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "recaptcha",
    name: "Google reCAPTCHA",
    function: "Bot protection on public forms (e.g. contact).",
    informationHeld: "Site key and secret key in each site system config.",
    configPaths: "system.recaptcha.siteKey | .secretKey",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "brevo",
    name: "Brevo",
    function: "Transactional and bulk email for most sites (mail provider when set to brevo).",
    informationHeld: "API key in the site brevo config document; sending behaviour driven by mail settings.",
    configPaths: "config.brevo.apiKey, system.mailDefaults.mailProvider",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "walksManager",
    name: "Ramblers Walks Manager",
    function: "Upload and sync of walks with Head Office Walks Manager.",
    informationHeld: "API key and optional interactive username/password in national walks manager settings.",
    configPaths: "system.national.walksManager.apiKey | .userName | .password",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "metaFacebookInstagram",
    name: "Meta (Facebook / Instagram)",
    function: "Optional publishing and links for Facebook Pages and Instagram professional accounts.",
    informationHeld: "App ID, app secret, page ID, page access token, page URL, publishing flag; Instagram user id and group name.",
    configPaths: "system.externalSystems.facebook.*, system.externalSystems.instagram.*",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "meetup",
    name: "Meetup",
    function: "Optional Meetup group integration (OAuth and/or API key).",
    informationHeld: "OAuth client ID/secret, access and refresh tokens, legacy API key, group name/slug.",
    configPaths: "system.externalSystems.meetup.*",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "salesforce",
    name: "Salesforce / Team Emails",
    function: "Optional Ramblers Team Emails supporter data integration.",
    informationHeld: "Enabled flag, endpoint base URL, API keys keyed by group code (codes listed; values not written).",
    configPaths: "config.salesforce.enabled | .endpointBaseUrl | .apiKeysByGroupCode",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "googleAnalytics",
    name: "Google Analytics",
    function: "Optional site traffic measurement.",
    informationHeld: "Tracking ID (G-… or UA-…) in system config.",
    configPaths: "system.googleAnalytics.trackingId",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "googleSearchConsole",
    name: "Google Search Console",
    function: "Optional site ownership verification for search indexing.",
    informationHeld: "Verification ID used in the meta tag.",
    configPaths: "system.googleSearchConsole.verificationId",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "gmailInbox",
    name: "Gmail (committee inbox)",
    function: "Optional committee inbox via Gmail OAuth and Pub/Sub push.",
    informationHeld: "OAuth client ID/secret, redirect URI, Pub/Sub project id.",
    configPaths: "system.googleInbox.clientId | .clientSecret | .redirectUri | .pubsubProjectId",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "webPush",
    name: "Web Push (VAPID)",
    function: "Browser push notifications for the committee inbox where enabled.",
    informationHeld: "VAPID public key, private key, and subject (mailto:…).",
    configPaths: "system.inboxPush.vapidPublicKey | .vapidPrivateKey | .vapidSubject",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "flickr",
    name: "Flickr",
    function: "Optional external album import.",
    informationHeld: "API key in system external systems.",
    configPaths: "system.externalSystems.flickr.apiKey",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "youtube",
    name: "YouTube",
    function: "Optional public channel link for the group.",
    informationHeld: "Channel URL only (no API secret in standard config).",
    configPaths: "system.externalSystems.youtube.groupUrl",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "twitter",
    name: "X (Twitter)",
    function: "Optional public profile link for the group.",
    informationHeld: "Profile URL only (no API secret in standard config).",
    configPaths: "system.externalSystems.twitter.groupUrl",
    scope: EstateRebuildSystemScope.PER_SITE
  },
  {
    systemId: "aiTextGeneration",
    name: "AI text generation (OpenAI-compatible)",
    function: "Optional platform-wide rewrite of walk descriptions (e.g. photo album reports) via a configured model endpoint.",
    informationHeld: "Enabled flag, provider type, base URL, model name, API key (platform config; per-env override may exist on EnvironmentConfig.ai).",
    configPaths: "config.environments.ai.enabled | .provider | .baseUrl | .model | .apiKey",
    scope: EstateRebuildSystemScope.PLATFORM
  }
];
