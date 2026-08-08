import { EnvironmentConsoleAccess } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export enum EstateRebuildFieldSource {
  INFRA = "infra",
  SYSTEM = "system",
  BREVO = "brevo",
  SALESFORCE = "salesforce",
  COMMITTEE = "committee",
  CONSOLE = "console"
}

export enum EstateRebuildFieldLayer {
  RUNTIME = "runtime",
  APPLICATION = "application",
  PEOPLE = "people",
  CONSOLE = "console"
}

export enum EstateRebuildConfigured {
  PRESENT = "present",
  EMPTY = "empty",
  ERROR = "error"
}

export interface EstateRebuildSiteFieldDefinition {
  fieldId: string;
  category: string;
  label: string;
  whereHeld: string;
  source: EstateRebuildFieldSource;
  layer: EstateRebuildFieldLayer;
}

export interface EstateRebuildPlatformFieldDefinition {
  fieldId: string;
  category: string;
  label: string;
  whereHeld: string;
}

export enum EstateRebuildSystemScope {
  PER_SITE = "per-site",
  PLATFORM = "platform",
  PER_SITE_AND_PLATFORM = "per-site-and-platform"
}

export interface EstateRebuildThirdPartySystem {
  systemId: string;
  name: string;
  function: string;
  informationHeld: string;
  configPaths: string;
  scope: EstateRebuildSystemScope;
}

export interface EstateRebuildInfraSnapshot {
  environment: string;
  ngxLite: boolean;
  awsBucket: string;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  mongoCluster: string;
  mongoDb: string;
  mongoUsername: string;
  mongoPassword: string;
  flyAppName: string;
  flyOrganisation: string;
  flyMemory: string;
  flyScaleCount: string;
  flyApiKey: string;
  cloudflareZoneId: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  authSecret: string;
  secretEntries: Record<string, string>;
  customDomains: string[];
  consoleAccess: EnvironmentConsoleAccess;
}

export interface EstateRebuildSiteProbe {
  environment: string;
  error?: string;
  groupLongName: string;
  groupCode: string;
  areaCode: string;
  siteHref: string;
  mailProvider: string;
  googleMapsApiKey: string;
  osMapsApiKey: string;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
  brevoApiKey: string;
  wmApiKey: string;
  wmUsername: string;
  wmPassword: string;
  facebookAppId: string;
  facebookAppSecret: string;
  facebookPageId: string;
  facebookPageAccessToken: string;
  facebookPagesUrl: string;
  facebookPublishingEnabled: boolean;
  instagramUserId: string;
  instagramGroupName: string;
  meetupClientId: string;
  meetupClientSecret: string;
  meetupAccessToken: string;
  meetupRefreshToken: string;
  meetupApiKey: string;
  meetupGroupName: string;
  salesforceEnabled: boolean;
  salesforceEndpoint: string;
  salesforceApiKeysSummary: string;
  salesforceApiKeysDetail: string;
  googleAnalyticsId: string;
  cloudflareWebAnalyticsToken: string;
  googleSearchConsoleVerification: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRedirectUri: string;
  gmailPubsubProject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  flickrApiKey: string;
  youtubeUrl: string;
  twitterUrl: string;
  chairmanRoleType: string;
  chairmanName: string;
  chairmanEmail: string;
  webmasterRoleType: string;
  webmasterName: string;
  webmasterEmail: string;
  siteContactsSummary: string;
}

export interface EstateRebuildPlatformSnapshot {
  autoDeployTarget: string;
  dockerImage: string;
  region: string;
  globalAwsBucket: string;
  globalAwsRegion: string;
  globalAwsAccessKeyId: string;
  globalAwsSecretAccessKey: string;
  globalCloudflareAccountId: string;
  globalCloudflareApiToken: string;
  globalCloudflareZoneId: string;
  globalCloudflareBaseDomain: string;
  globalSecretEntries: Record<string, string>;
  aiEnabled: boolean;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  workerAppName: string;
  workerApiKey: string;
  workerSharedSecret: string;
  workerEncryptionKey: string;
  workerMemory: string;
  workerScaleCount: string;
  consoleAccess: EnvironmentConsoleAccess;
}

export interface EstateRebuildCaptureRow {
  environment: string;
  group: string;
  layer: EstateRebuildFieldLayer;
  category: string;
  fieldId: string;
  field: string;
  configured: EstateRebuildConfigured;
  safeValue: string;
  whereHeld: string;
}

export interface EstateRebuildPlatformCaptureRow {
  category: string;
  fieldId: string;
  field: string;
  configured: EstateRebuildConfigured;
  safeValue: string;
  whereHeld: string;
}

export enum EstateRebuildCaptureFormat {
  XLSX = "xlsx",
  MARKDOWN = "md",
  HTML = "html"
}

export interface EstateRebuildGenerateOptions {
  includeSecrets: boolean;
}

export interface EstateRebuildSiteDirectoryRow {
  environment: string;
  group: string;
  groupCode: string;
  areaCode: string;
  siteHref: string;
  flyAppName: string;
  mongoCluster: string;
  mongoDb: string;
  mongoUsername: string;
  awsBucket: string;
  awsRegion: string;
  customDomains: string;
  mailProvider: string;
  chairmanName: string;
  chairmanEmail: string;
  webmasterName: string;
  webmasterEmail: string;
  siteContactsSummary: string;
  ngxLite: boolean;
  probeStatus: string;
}

export interface EstateRebuildInventory {
  generatedAtUtc: string;
  includeSecrets: boolean;
  siteCount: number;
  fieldsPerSite: number;
  siteCaptureRows: number;
  platformFieldCount: number;
  thirdPartySystems: EstateRebuildThirdPartySystem[];
  sites: EstateRebuildSiteDirectoryRow[];
  siteCapture: EstateRebuildCaptureRow[];
  platformCapture: EstateRebuildPlatformCaptureRow[];
}

export interface EstateRebuildArtifacts {
  generatedAtUtc: string;
  siteCount: number;
  fieldsPerSite: number;
  siteCaptureRows: number;
  platformFieldCount: number;
  includeSecrets: boolean;
  xlsx: Buffer;
  markdown: string;
  html: string;
  xlsxFileName: string;
  markdownFileName: string;
  htmlFileName: string;
}

export interface EstateRebuildGenerationResult extends EstateRebuildArtifacts {
  xlsxPath: string | null;
  markdownPath: string | null;
  htmlPath: string | null;
}
