#!/usr/bin/env node
import { createHash } from "crypto";
import debug from "debug";
import { Workbook, Worksheet } from "exceljs";
import { isArray, isBoolean, isObject, isString, keys } from "es-toolkit/compat";
import { mkdirSync, writeFileSync } from "fs";
import { MongoClient } from "mongodb";
import { CommitteeConfig, CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  ConsoleAccessService,
  EnvironmentConfig,
  EnvironmentsConfig
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeNow, formatDateTime } from "../shared/dates";
import { buildMongoUri } from "../shared/mongodb-uri";
import { resolveClientPath } from "../shared/path-utils";
import {
  EstateRebuildArtifacts,
  EstateRebuildCaptureRow,
  EstateRebuildConfigured,
  EstateRebuildGenerateOptions,
  EstateRebuildGenerationResult,
  EstateRebuildInfraSnapshot,
  EstateRebuildInventory,
  EstateRebuildPlatformCaptureRow,
  EstateRebuildPlatformSnapshot,
  EstateRebuildSiteDirectoryRow,
  EstateRebuildSiteProbe
} from "./estate-rebuild-capture.model";
import {
  ConsoleAccessFieldKind,
  consoleAccessIdentifierValue,
  consoleAccessValue,
  isConsoleAccessPasswordField
} from "./console-access-catalogue";
import { PLATFORM_FIELDS, SITE_FIELDS, THIRD_PARTY_SYSTEMS } from "./estate-rebuild-fields";

const debugLog = debug(envConfig.logNamespace("ops:estate-rebuild-capture"));
debugLog.enabled = true;

const OPS_DIR = resolveClientPath("non-vcs", "ops");
const XLSX_PATH = resolveClientPath("non-vcs", "ops", "estate-rebuild-capture.xlsx");
const MD_PATH = resolveClientPath("non-vcs", "ops", "estate-rebuild-capture.md");
const HTML_PATH = resolveClientPath("non-vcs", "ops", "estate-rebuild-capture.html");
const XLSX_FILE_NAME = "estate-rebuild-capture.xlsx";
const MD_FILE_NAME = "estate-rebuild-capture.md";
const HTML_FILE_NAME = "estate-rebuild-capture.html";

const HEADER_FILL = "1F4E79";
const EMPTY_FILL = "F8CBAD";
const PRESENT_FILL = "C6EFCE";

function present(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  } else if (isString(value)) {
    return value.length > 0;
  } else if (isBoolean(value)) {
    return value;
  } else if (isArray(value)) {
    return value.length > 0;
  } else if (isObject(value)) {
    return keys(value).length > 0;
  } else {
    return true;
  }
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  } else {
    return String(value);
  }
}

function yn(value: boolean): string {
  return value ? "Y" : "";
}

function setLabel(value: boolean): string {
  return value ? "SET" : "";
}

function secretOrPresence(value: string, includeSecrets: boolean): string {
  if (!present(value)) {
    return "";
  } else if (includeSecrets) {
    return value;
  } else {
    return "SET";
  }
}

function secretMapOrKeys(entries: Record<string, string>, includeSecrets: boolean): string {
  const names = keys(entries);
  if (names.length === 0) {
    return "";
  } else if (includeSecrets) {
    return names.map(name => `${name}=${entries[name]}`).join("; ");
  } else {
    return names.join(", ");
  }
}

function roleHaystack(role: CommitteeMember): string {
  return `${role.type || ""} ${role.description || ""}`.toLowerCase();
}

function isVacantRole(role: CommitteeMember | null | undefined): boolean {
  if (!role) {
    return true;
  } else if (role.vacant === true) {
    return true;
  } else {
    const name = asText(role.fullName).toLowerCase();
    return name.includes("(vacant)") || name === "vacant";
  }
}

function pickCommitteeRole(roles: CommitteeMember[], preferredTypes: string[], tokens: string[], excludeTokens: string[] = []): CommitteeMember | null {
  const candidates = roles.filter(role => {
    const hay = roleHaystack(role);
    const excluded = excludeTokens.some(token => hay.includes(token));
    if (excluded) {
      return false;
    } else {
      const typeMatch = preferredTypes.includes(asText(role.type).toLowerCase());
      const tokenMatch = tokens.some(token => hay.includes(token));
      return typeMatch || tokenMatch;
    }
  });
  const exactPreferred = preferredTypes
    .map(type => candidates.find(role => asText(role.type).toLowerCase() === type && !isVacantRole(role)))
    .find(Boolean);
  if (exactPreferred) {
    return exactPreferred;
  } else {
    const nonVacant = candidates.find(role => !isVacantRole(role));
    if (nonVacant) {
      return nonVacant;
    } else {
      return candidates[0] || null;
    }
  }
}

function contactLine(label: string, role: CommitteeMember | null): string {
  if (!role) {
    return "";
  } else {
    const name = asText(role.fullName) || (isVacantRole(role) ? "(Vacant)" : "");
    const email = asText(role.email);
    if (name && email) {
      return `${label}: ${name} <${email}>`;
    } else if (name) {
      return `${label}: ${name}`;
    } else if (email) {
      return `${label}: <${email}>`;
    } else {
      return "";
    }
  }
}

function contactsFromCommittee(committee: CommitteeConfig | undefined): Pick<
  EstateRebuildSiteProbe,
  | "chairmanRoleType"
  | "chairmanName"
  | "chairmanEmail"
  | "webmasterRoleType"
  | "webmasterName"
  | "webmasterEmail"
  | "siteContactsSummary"
> {
  const roles = committee?.roles || [];
  const chairmanFromRoles = pickCommitteeRole(
    roles,
    ["chairman", "chair", "area-chairman"],
    ["chairman", "chair"],
    ["vice"]
  );
  const chairmanFromContactUs = committee?.contactUs?.chairman;
  const chairman = (!isVacantRole(chairmanFromRoles) ? chairmanFromRoles : null)
    || (!isVacantRole(chairmanFromContactUs) ? chairmanFromContactUs : null)
    || chairmanFromRoles
    || chairmanFromContactUs
    || null;
  const webmaster = pickCommitteeRole(
    roles,
    ["webmaster", "system-administrator"],
    ["webmaster", "website", "system-administrator", "system administrator"],
    []
  );
  const summaryParts = [
    contactLine("Chairman", chairman),
    contactLine("Webmaster", webmaster)
  ].filter(present);
  return {
    chairmanRoleType: asText(chairman?.type),
    chairmanName: isVacantRole(chairman) ? (asText(chairman?.fullName) || "(Vacant)") : asText(chairman?.fullName),
    chairmanEmail: isVacantRole(chairman) ? "" : asText(chairman?.email),
    webmasterRoleType: asText(webmaster?.type),
    webmasterName: isVacantRole(webmaster) ? (asText(webmaster?.fullName) || "(Vacant)") : asText(webmaster?.fullName),
    webmasterEmail: isVacantRole(webmaster) ? "" : asText(webmaster?.email),
    siteContactsSummary: summaryParts.join("; ")
  };
}

function emptyContacts(): Pick<
  EstateRebuildSiteProbe,
  | "chairmanRoleType"
  | "chairmanName"
  | "chairmanEmail"
  | "webmasterRoleType"
  | "webmasterName"
  | "webmasterEmail"
  | "siteContactsSummary"
> {
  return {
    chairmanRoleType: "",
    chairmanName: "",
    chairmanEmail: "",
    webmasterRoleType: "",
    webmasterName: "",
    webmasterEmail: "",
    siteContactsSummary: ""
  };
}

function infraFrom(env: EnvironmentConfig): EstateRebuildInfraSnapshot {
  return {
    environment: env.environment,
    ngxLite: env.ngxLite === true,
    awsBucket: env.aws?.bucket || "",
    awsRegion: env.aws?.region || "",
    awsAccessKeyId: asText(env.aws?.accessKeyId),
    awsSecretAccessKey: asText(env.aws?.secretAccessKey),
    mongoCluster: env.mongo?.cluster || "",
    mongoDb: env.mongo?.db || "",
    mongoUsername: env.mongo?.username || "",
    mongoPassword: asText(env.mongo?.password),
    flyAppName: env.flyio?.appName || "",
    flyOrganisation: env.flyio?.organisation || "",
    flyMemory: env.flyio?.memory || "",
    flyScaleCount: env.flyio?.scaleCount == null ? "" : String(env.flyio.scaleCount),
    flyApiKey: asText(env.flyio?.apiKey),
    cloudflareZoneId: asText(env.cloudflare?.zoneId),
    cloudflareAccountId: asText(env.cloudflare?.accountId),
    cloudflareApiToken: asText(env.cloudflare?.apiToken),
    authSecret: asText(env.secrets?.AUTH_SECRET),
    secretEntries: env.secrets || {},
    customDomains: (env.customDomains || []).map(domain => domain.hostname).filter(present),
    consoleAccess: env.consoleAccess || {}
  };
}

function platformFrom(config: EnvironmentsConfig): EstateRebuildPlatformSnapshot {
  return {
    autoDeployTarget: asText(config.autoDeployTarget),
    dockerImage: asText(config.dockerImage),
    region: asText(config.region),
    globalAwsBucket: asText(config.aws?.bucket),
    globalAwsRegion: asText(config.aws?.region),
    globalAwsAccessKeyId: asText(config.aws?.accessKeyId),
    globalAwsSecretAccessKey: asText(config.aws?.secretAccessKey),
    globalCloudflareAccountId: asText(config.cloudflare?.accountId),
    globalCloudflareApiToken: asText(config.cloudflare?.apiToken),
    globalCloudflareZoneId: asText(config.cloudflare?.zoneId),
    globalCloudflareBaseDomain: asText(config.cloudflare?.baseDomain),
    globalSecretEntries: config.secrets || {},
    aiEnabled: config.ai?.enabled === true,
    aiProvider: asText(config.ai?.provider),
    aiBaseUrl: asText(config.ai?.baseUrl),
    aiModel: asText(config.ai?.model),
    aiApiKey: asText(config.ai?.apiKey),
    workerAppName: asText(config.uploadWorker?.appName),
    workerApiKey: asText(config.uploadWorker?.apiKey),
    workerSharedSecret: asText(config.uploadWorker?.sharedSecret),
    workerEncryptionKey: asText(config.uploadWorker?.encryptionKey),
    workerMemory: asText(config.uploadWorker?.memory),
    workerScaleCount: config.uploadWorker?.scaleCount == null ? "" : String(config.uploadWorker.scaleCount),
    consoleAccess: config.consoleAccess || {}
  };
}

function consoleFieldValue(
  fieldId: string,
  access: EnvironmentConfig["consoleAccess"],
  includeSecrets: boolean
): string | null {
  const sitePrefix = "consoleAccess.";
  const platformPrefix = "platformConsoleAccess.";
  let path = "";
  if (fieldId.startsWith(sitePrefix)) {
    path = fieldId.slice(sitePrefix.length);
  } else if (fieldId.startsWith(platformPrefix)) {
    path = fieldId.slice(platformPrefix.length);
  } else {
    return null;
  }
  const parts = path.split(".");
  if (parts.length === 2) {
    const serviceId = parts[0] as ConsoleAccessService;
    const kind = parts[1] as ConsoleAccessFieldKind;
    const raw = consoleAccessValue(access, serviceId, kind);
    if (isConsoleAccessPasswordField(fieldId)) {
      return secretOrPresence(raw, includeSecrets);
    } else {
      return raw;
    }
  } else if (parts.length === 3 && parts[1] === "identifiers") {
    const serviceId = parts[0] as ConsoleAccessService;
    const identifierKey = parts[2];
    return consoleAccessIdentifierValue(access, serviceId, identifierKey);
  } else {
    return "";
  }
}

async function probeSite(env: EnvironmentConfig): Promise<EstateRebuildSiteProbe> {
  const base: EstateRebuildSiteProbe = {
    environment: env.environment,
    groupLongName: "",
    groupCode: "",
    areaCode: "",
    siteHref: "",
    mailProvider: "",
    googleMapsApiKey: "",
    osMapsApiKey: "",
    recaptchaSiteKey: "",
    recaptchaSecretKey: "",
    brevoApiKey: "",
    wmApiKey: "",
    wmUsername: "",
    wmPassword: "",
    facebookAppId: "",
    facebookAppSecret: "",
    facebookPageId: "",
    facebookPageAccessToken: "",
    facebookPagesUrl: "",
    facebookPublishingEnabled: false,
    instagramUserId: "",
    instagramGroupName: "",
    meetupClientId: "",
    meetupClientSecret: "",
    meetupAccessToken: "",
    meetupRefreshToken: "",
    meetupApiKey: "",
    meetupGroupName: "",
    salesforceEnabled: false,
    salesforceEndpoint: "",
    salesforceApiKeysSummary: "",
    salesforceApiKeysDetail: "",
    googleAnalyticsId: "",
    cloudflareWebAnalyticsToken: "",
    googleSearchConsoleVerification: "",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRedirectUri: "",
    gmailPubsubProject: "",
    vapidPublicKey: "",
    vapidPrivateKey: "",
    vapidSubject: "",
    flickrApiKey: "",
    youtubeUrl: "",
    twitterUrl: "",
    ...emptyContacts()
  };

  if (!env.mongo?.cluster || !env.mongo?.db || !env.mongo?.username || !env.mongo?.password) {
    return {...base, error: "no mongo credentials in staging config"};
  } else {
    const uri = buildMongoUri({
      cluster: env.mongo.cluster,
      username: env.mongo.username,
      password: env.mongo.password,
      database: env.mongo.db
    });
    const client = await MongoClient.connect(uri).catch(error => {
      debugLog("Probe connect failed for %s: %s", env.environment, error.message);
      return null;
    });
    if (!client) {
      return {...base, error: "could not connect to site database"};
    } else {
      try {
        const db = client.db(env.mongo.db);
        const systemDoc = await db.collection("config").findOne({key: ConfigKey.SYSTEM});
        const brevoDoc = await db.collection("config").findOne({key: ConfigKey.BREVO});
        const salesforceDoc = await db.collection("config").findOne({key: ConfigKey.SALESFORCE});
        const committeeDoc = await db.collection("config").findOne({key: ConfigKey.COMMITTEE});
        const system = (systemDoc?.value || {}) as SystemConfig;
        const brevo = brevoDoc?.value as {apiKey?: string} | undefined;
        const salesforce = salesforceDoc?.value as {
          enabled?: boolean;
          endpointBaseUrl?: string;
          apiKeysByGroupCode?: Record<string, string>;
        } | undefined;
        const committee = committeeDoc?.value as CommitteeConfig | undefined;
        const contacts = contactsFromCommittee(committee);
        const salesforceKeyMap = salesforce?.apiKeysByGroupCode || {};
        const salesforceCodes = keys(salesforceKeyMap);
        return {
          ...base,
          ...contacts,
          groupLongName: asText(system.group?.longName),
          groupCode: asText(system.group?.groupCode),
          areaCode: asText(system.area?.groupCode),
          siteHref: asText(system.group?.href),
          mailProvider: asText(system.mailDefaults?.mailProvider),
          googleMapsApiKey: asText(system.googleMaps?.apiKey),
          osMapsApiKey: asText(system.externalSystems?.osMaps?.apiKey),
          recaptchaSiteKey: asText(system.recaptcha?.siteKey),
          recaptchaSecretKey: asText(system.recaptcha?.secretKey),
          brevoApiKey: asText(brevo?.apiKey),
          wmApiKey: asText(system.national?.walksManager?.apiKey),
          wmUsername: asText(system.national?.walksManager?.userName),
          wmPassword: asText(system.national?.walksManager?.password),
          facebookAppId: asText(system.externalSystems?.facebook?.appId),
          facebookAppSecret: asText(system.externalSystems?.facebook?.appSecret),
          facebookPageId: asText(system.externalSystems?.facebook?.pageId),
          facebookPageAccessToken: asText(system.externalSystems?.facebook?.pageAccessToken),
          facebookPagesUrl: asText(system.externalSystems?.facebook?.pagesUrl),
          facebookPublishingEnabled: system.externalSystems?.facebook?.publishingEnabled === true,
          instagramUserId: asText(system.externalSystems?.instagram?.igUserId),
          instagramGroupName: asText(system.externalSystems?.instagram?.groupName),
          meetupClientId: asText(system.externalSystems?.meetup?.clientId),
          meetupClientSecret: asText(system.externalSystems?.meetup?.clientSecret),
          meetupAccessToken: asText(system.externalSystems?.meetup?.accessToken),
          meetupRefreshToken: asText(system.externalSystems?.meetup?.refreshToken),
          meetupApiKey: asText(system.externalSystems?.meetup?.apiKey),
          meetupGroupName: asText(system.externalSystems?.meetup?.groupName),
          salesforceEnabled: salesforce?.enabled === true,
          salesforceEndpoint: asText(salesforce?.endpointBaseUrl),
          salesforceApiKeysSummary: salesforceCodes.length > 0 ? `${salesforceCodes.length} keys: ${salesforceCodes.join(", ")}` : "",
          salesforceApiKeysDetail: salesforceCodes.map(code => `${code}=${salesforceKeyMap[code]}`).join("; "),
          googleAnalyticsId: asText(system.googleAnalytics?.trackingId),
          cloudflareWebAnalyticsToken: asText(system.cloudflareWebAnalytics?.siteToken),
          googleSearchConsoleVerification: asText(system.googleSearchConsole?.verificationId),
          gmailClientId: asText(system.googleInbox?.clientId),
          gmailClientSecret: asText(system.googleInbox?.clientSecret),
          gmailRedirectUri: asText(system.googleInbox?.redirectUri),
          gmailPubsubProject: asText(system.googleInbox?.pubsubProjectId),
          vapidPublicKey: asText(system.inboxPush?.vapidPublicKey),
          vapidPrivateKey: asText(system.inboxPush?.vapidPrivateKey),
          vapidSubject: asText(system.inboxPush?.vapidSubject),
          flickrApiKey: asText(system.externalSystems?.flickr?.apiKey),
          youtubeUrl: asText(system.externalSystems?.youtube?.groupUrl),
          twitterUrl: asText(system.externalSystems?.twitter?.groupUrl)
        };
      } finally {
        await client.close();
      }
    }
  }
}

function safeValueFor(
  fieldId: string,
  infra: EstateRebuildInfraSnapshot,
  site: EstateRebuildSiteProbe,
  includeSecrets: boolean
): string {
  if (site.error && !fieldId.startsWith("consoleAccess.")) {
    return `ERROR: ${site.error}`;
  } else {
    const consoleValue = consoleFieldValue(fieldId, infra.consoleAccess, includeSecrets);
    const values: Record<string, string> = {
      environment: infra.environment,
      groupLongName: site.groupLongName,
      groupCode: site.groupCode,
      areaCode: site.areaCode,
      siteHref: site.siteHref,
      flyAppName: infra.flyAppName,
      customDomains: infra.customDomains.join(", "),
      mailProvider: site.mailProvider,
      ngxLite: yn(infra.ngxLite),
      mongoCluster: infra.mongoCluster,
      mongoDb: infra.mongoDb,
      mongoUsername: infra.mongoUsername,
      mongoPassword: secretOrPresence(infra.mongoPassword, includeSecrets),
      awsBucket: infra.awsBucket,
      awsRegion: infra.awsRegion,
      awsAccessKeyId: secretOrPresence(infra.awsAccessKeyId, includeSecrets),
      awsSecretAccessKey: secretOrPresence(infra.awsSecretAccessKey, includeSecrets),
      flyOrganisation: infra.flyOrganisation,
      flyApiToken: secretOrPresence(infra.flyApiKey, includeSecrets),
      flyMemory: infra.flyMemory,
      flyScaleCount: infra.flyScaleCount,
      cloudflareZoneId: infra.cloudflareZoneId,
      cloudflareAccountId: infra.cloudflareAccountId,
      cloudflareApiToken: secretOrPresence(infra.cloudflareApiToken, includeSecrets),
      authSecret: secretOrPresence(infra.authSecret, includeSecrets),
      secretKeys: secretMapOrKeys(infra.secretEntries, includeSecrets),
      googleMapsApiKey: secretOrPresence(site.googleMapsApiKey, includeSecrets),
      osMapsApiKey: secretOrPresence(site.osMapsApiKey, includeSecrets),
      recaptchaSiteKey: site.recaptchaSiteKey,
      recaptchaSecretKey: secretOrPresence(site.recaptchaSecretKey, includeSecrets),
      brevoApiKey: secretOrPresence(site.brevoApiKey, includeSecrets),
      wmApiKey: secretOrPresence(site.wmApiKey, includeSecrets),
      wmUsername: site.wmUsername,
      wmPassword: secretOrPresence(site.wmPassword, includeSecrets),
      facebookAppId: site.facebookAppId,
      facebookAppSecret: secretOrPresence(site.facebookAppSecret, includeSecrets),
      facebookPageId: site.facebookPageId,
      facebookPageAccessToken: secretOrPresence(site.facebookPageAccessToken, includeSecrets),
      facebookPagesUrl: site.facebookPagesUrl,
      facebookPublishingEnabled: yn(site.facebookPublishingEnabled),
      instagramUserId: site.instagramUserId,
      instagramGroupName: site.instagramGroupName,
      meetupClientId: site.meetupClientId,
      meetupClientSecret: secretOrPresence(site.meetupClientSecret, includeSecrets),
      meetupAccessToken: secretOrPresence(site.meetupAccessToken, includeSecrets),
      meetupRefreshToken: secretOrPresence(site.meetupRefreshToken, includeSecrets),
      meetupApiKey: secretOrPresence(site.meetupApiKey, includeSecrets),
      meetupGroupName: site.meetupGroupName,
      salesforceEnabled: yn(site.salesforceEnabled),
      salesforceEndpoint: site.salesforceEndpoint,
      salesforceApiKeys: includeSecrets && site.salesforceApiKeysDetail
        ? site.salesforceApiKeysDetail
        : site.salesforceApiKeysSummary,
      googleAnalyticsId: site.googleAnalyticsId,
      cloudflareWebAnalyticsToken: secretOrPresence(site.cloudflareWebAnalyticsToken, includeSecrets),
      googleSearchConsoleVerification: site.googleSearchConsoleVerification,
      gmailClientId: site.gmailClientId,
      gmailClientSecret: secretOrPresence(site.gmailClientSecret, includeSecrets),
      gmailRedirectUri: site.gmailRedirectUri,
      gmailPubsubProject: site.gmailPubsubProject,
      vapidPublicKey: site.vapidPublicKey,
      vapidPrivateKey: secretOrPresence(site.vapidPrivateKey, includeSecrets),
      vapidSubject: site.vapidSubject,
      flickrApiKey: secretOrPresence(site.flickrApiKey, includeSecrets),
      youtubeUrl: site.youtubeUrl,
      twitterUrl: site.twitterUrl,
      chairmanRoleType: site.chairmanRoleType,
      chairmanName: site.chairmanName,
      chairmanEmail: site.chairmanEmail,
      webmasterRoleType: site.webmasterRoleType,
      webmasterName: site.webmasterName,
      webmasterEmail: site.webmasterEmail,
      siteContactsSummary: site.siteContactsSummary
    };
    if (consoleValue !== null) {
      return consoleValue;
    } else {
      return values[fieldId] ?? "";
    }
  }
}

function platformSafeValue(fieldId: string, platform: EstateRebuildPlatformSnapshot, includeSecrets: boolean): string {
  const consoleValue = consoleFieldValue(fieldId, platform.consoleAccess, includeSecrets);
  const values: Record<string, string> = {
    autoDeployTarget: platform.autoDeployTarget,
    dockerImage: platform.dockerImage,
    region: platform.region,
    globalAwsBucket: platform.globalAwsBucket,
    globalAwsRegion: platform.globalAwsRegion,
    globalAwsAccessKeyId: secretOrPresence(platform.globalAwsAccessKeyId, includeSecrets),
    globalAwsSecretAccessKey: secretOrPresence(platform.globalAwsSecretAccessKey, includeSecrets),
    globalCloudflareAccountId: platform.globalCloudflareAccountId,
    globalCloudflareApiToken: secretOrPresence(platform.globalCloudflareApiToken, includeSecrets),
    globalCloudflareZoneId: platform.globalCloudflareZoneId,
    globalCloudflareBaseDomain: platform.globalCloudflareBaseDomain,
    globalSecretsKeys: secretMapOrKeys(platform.globalSecretEntries, includeSecrets),
    aiEnabled: yn(platform.aiEnabled),
    aiProvider: platform.aiProvider,
    aiBaseUrl: platform.aiBaseUrl,
    aiModel: platform.aiModel,
    aiApiKey: secretOrPresence(platform.aiApiKey, includeSecrets),
    workerAppName: platform.workerAppName,
    workerApiKey: secretOrPresence(platform.workerApiKey, includeSecrets),
    workerSharedSecret: secretOrPresence(platform.workerSharedSecret, includeSecrets),
    workerEncryptionKey: secretOrPresence(platform.workerEncryptionKey, includeSecrets),
    workerMemory: platform.workerMemory,
    workerScaleCount: platform.workerScaleCount
  };
  if (consoleValue !== null) {
    return consoleValue;
  } else {
    return values[fieldId] ?? "";
  }
}

function configuredFromValue(value: string, probeError?: string): EstateRebuildConfigured {
  if (probeError) {
    return EstateRebuildConfigured.ERROR;
  } else if (!value) {
    return EstateRebuildConfigured.EMPTY;
  } else if (value.startsWith("ERROR")) {
    return EstateRebuildConfigured.ERROR;
  } else {
    return EstateRebuildConfigured.PRESENT;
  }
}

function configuredFor(
  fieldId: string,
  infra: EstateRebuildInfraSnapshot,
  site: EstateRebuildSiteProbe,
  includeSecrets: boolean
): EstateRebuildConfigured {
  return configuredFromValue(safeValueFor(fieldId, infra, site, includeSecrets), site.error);
}

function buildPlatformRows(
  platform: EstateRebuildPlatformSnapshot,
  includeSecrets: boolean
): EstateRebuildPlatformCaptureRow[] {
  return PLATFORM_FIELDS.map(field => {
    const safeValue = platformSafeValue(field.fieldId, platform, includeSecrets);
    return {
      category: field.category,
      fieldId: field.fieldId,
      field: field.label,
      configured: configuredFromValue(safeValue),
      safeValue,
      whereHeld: field.whereHeld
    };
  });
}

function buildCaptureRows(
  infraList: EstateRebuildInfraSnapshot[],
  probes: EstateRebuildSiteProbe[],
  includeSecrets: boolean
): EstateRebuildCaptureRow[] {
  return infraList.flatMap(infra => {
    const site = probes.find(probe => probe.environment === infra.environment) || {
      environment: infra.environment,
      error: "missing probe",
      groupLongName: "",
      groupCode: "",
      areaCode: "",
      siteHref: "",
      mailProvider: "",
      googleMapsApiKey: "",
      osMapsApiKey: "",
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      brevoApiKey: "",
      wmApiKey: "",
      wmUsername: "",
      wmPassword: "",
      facebookAppId: "",
      facebookAppSecret: "",
      facebookPageId: "",
      facebookPageAccessToken: "",
      facebookPagesUrl: "",
      facebookPublishingEnabled: false,
      instagramUserId: "",
      instagramGroupName: "",
      meetupClientId: "",
      meetupClientSecret: "",
      meetupAccessToken: "",
      meetupRefreshToken: "",
      meetupApiKey: "",
      meetupGroupName: "",
      salesforceEnabled: false,
      salesforceEndpoint: "",
      salesforceApiKeysSummary: "",
      salesforceApiKeysDetail: "",
      googleAnalyticsId: "",
      cloudflareWebAnalyticsToken: "",
      googleSearchConsoleVerification: "",
      gmailClientId: "",
      gmailClientSecret: "",
      gmailRedirectUri: "",
      gmailPubsubProject: "",
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: "",
      flickrApiKey: "",
      youtubeUrl: "",
      twitterUrl: "",
      ...emptyContacts()
    } as EstateRebuildSiteProbe;
    return SITE_FIELDS.map(field => ({
      environment: infra.environment,
      group: site.groupLongName,
      layer: field.layer,
      category: field.category,
      fieldId: field.fieldId,
      field: field.label,
      configured: configuredFor(field.fieldId, infra, site, includeSecrets),
      safeValue: safeValueFor(field.fieldId, infra, site, includeSecrets),
      whereHeld: field.whereHeld
    }));
  });
}

function styleHeader(sheet: Worksheet, columnCount: number): void {
  const row = sheet.getRow(1);
  row.font = {bold: true, color: {argb: `FF${"FFFFFF"}`}};
  row.fill = {type: "pattern", pattern: "solid", fgColor: {argb: `FF${HEADER_FILL}`}};
  row.alignment = {wrapText: true, vertical: "middle"};
  sheet.views = [{state: "frozen", ySplit: 1}];
  sheet.autoFilter = {
    from: {row: 1, column: 1},
    to: {row: 1, column: columnCount}
  };
}

function fillCell(sheet: Worksheet, row: number, column: number, colour: string): void {
  sheet.getCell(row, column).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {argb: `FF${colour}`}
  };
}

function autosize(sheet: Worksheet, maxWidth = 42): void {
  sheet.columns.forEach(column => {
    const values = (column.values || []).map(value => (value == null ? 0 : String(value).length));
    const widest = values.reduce((max, length) => Math.max(max, length), 12);
    column.width = Math.min(Math.max(widest + 2, 12), maxWidth);
  });
}

async function buildWorkbook(
  generatedAtUtc: string,
  infraList: EstateRebuildInfraSnapshot[],
  probes: EstateRebuildSiteProbe[],
  rows: EstateRebuildCaptureRow[],
  platformRows: EstateRebuildPlatformCaptureRow[],
  includeSecrets: boolean
): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "ngx-ramblers";
  workbook.created = dateTimeNow().toJSDate();

  const readme = workbook.addWorksheet("README");
  readme.addRow(["Field", "Value"]);
  [
    ["NGX-Ramblers platform configuration values", ""],
    ["Generated", generatedAtUtc],
    ["Issue", "https://github.com/nbarrett/ngx-ramblers/issues/287"],
    ["Rule", includeSecrets
      ? "SECRETS INCLUDED. This pack contains live passwords, API keys and tokens so environments can be rebuilt. Store only in a password manager. Do not commit to git or email."
      : "Secret values omitted: secrets show as SET or empty. Re-download with Include secrets for full configuration values."],
    ["Include secrets", includeSecrets ? "yes" : "no"],
    ["Sources", "staging config.environments (infra + platform) and each site Mongo config collection (system, brevo, salesforce, committee)"],
    ["Sheets", "README | Third-party systems | Field catalogue | Sites directory | Site values | Platform values"],
    ["Third-party systems", "One row per integrated system (MongoDB Atlas, AWS, Fly, maps, mail, …) with function and what config holds."],
    ["Layers", "runtime = config.environments[] for that site. application = site Mongo system/brevo/salesforce. people = committee contacts."],
    ["Configured?", "present = value found in live config. empty = not set. error = site database probe failed."],
    ["Regenerate", "Platform admin: Platform Configuration Values  or  cd server && npm run ops:estate-rebuild-capture"]
  ].forEach(entry => readme.addRow(entry));
  styleHeader(readme, 2);
  autosize(readme, 80);

  const systems = workbook.addWorksheet("Third-party systems");
  systems.addRow(["System ID", "System", "Scope", "Function", "Information held in NGX config", "Config paths"]);
  THIRD_PARTY_SYSTEMS.forEach(system => {
    systems.addRow([
      system.systemId,
      system.name,
      system.scope,
      system.function,
      system.informationHeld,
      system.configPaths
    ]);
  });
  styleHeader(systems, 6);
  autosize(systems, 60);
  systems.getColumn(4).width = 48;
  systems.getColumn(5).width = 48;
  systems.getColumn(6).width = 48;

  const catalogue = workbook.addWorksheet("Field catalogue");
  catalogue.addRow(["Applies to", "Layer", "Field ID", "Category", "Label", "Where it lives"]);
  SITE_FIELDS.forEach(field => {
    catalogue.addRow(["Each site", field.layer, field.fieldId, field.category, field.label, field.whereHeld]);
  });
  PLATFORM_FIELDS.forEach(field => {
    catalogue.addRow(["Platform (once)", "platform", field.fieldId, field.category, field.label, field.whereHeld]);
  });
  styleHeader(catalogue, 6);
  autosize(catalogue);

  const directory = workbook.addWorksheet("Sites directory");
  directory.addRow([
    "Environment", "Group", "Group code", "Area", "Public URL", "Fly app",
    "Mongo cluster", "Mongo DB", "Mongo user", "AWS bucket", "AWS region",
    "Custom domains", "Mail provider",
    "Chairman name", "Chairman email", "Webmaster name", "Webmaster email", "Site contacts summary",
    "ngxLite", "Probe status"
  ]);
  infraList.forEach(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    directory.addRow([
      infra.environment,
      site?.groupLongName || "",
      site?.groupCode || "",
      site?.areaCode || "",
      site?.siteHref || "",
      infra.flyAppName,
      infra.mongoCluster,
      infra.mongoDb,
      infra.mongoUsername,
      infra.awsBucket,
      infra.awsRegion,
      infra.customDomains.join(", "),
      site?.mailProvider || "",
      site?.chairmanName || "",
      site?.chairmanEmail || "",
      site?.webmasterName || "",
      site?.webmasterEmail || "",
      site?.siteContactsSummary || "",
      infra.ngxLite ? "Y" : "",
      site?.error ? "error" : "ok"
    ]);
  });
  styleHeader(directory, 20);
  autosize(directory);

  const capture = workbook.addWorksheet("Site values");
  capture.addRow([
    "Environment", "Group", "Layer", "Category", "Field ID", "Field",
    "Configured?", "Safe value / presence", "Where it lives"
  ]);
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    capture.addRow([
      row.environment,
      row.group,
      row.layer,
      row.category,
      row.fieldId,
      row.field,
      row.configured,
      row.safeValue,
      row.whereHeld
    ]);
    if (row.configured === EstateRebuildConfigured.PRESENT) {
      fillCell(capture, rowNumber, 7, PRESENT_FILL);
    } else if (row.configured === EstateRebuildConfigured.EMPTY) {
      fillCell(capture, rowNumber, 7, EMPTY_FILL);
    } else {
      fillCell(capture, rowNumber, 7, EMPTY_FILL);
    }
  });
  styleHeader(capture, 9);
  autosize(capture);
  capture.getColumn(8).width = 28;
  capture.getColumn(9).width = 48;

  const platform = workbook.addWorksheet("Platform values");
  platform.addRow([
    "Category", "Field ID", "Field", "Configured?", "Safe value / presence", "Where it lives"
  ]);
  platformRows.forEach((row, index) => {
    const rowNumber = index + 2;
    platform.addRow([
      row.category,
      row.fieldId,
      row.field,
      row.configured,
      row.safeValue,
      row.whereHeld
    ]);
    if (row.configured === EstateRebuildConfigured.PRESENT) {
      fillCell(platform, rowNumber, 4, PRESENT_FILL);
    } else {
      fillCell(platform, rowNumber, 4, EMPTY_FILL);
    }
  });
  styleHeader(platform, 6);
  autosize(platform);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildMarkdown(
  generatedAtUtc: string,
  infraList: EstateRebuildInfraSnapshot[],
  probes: EstateRebuildSiteProbe[],
  platformRows: EstateRebuildPlatformCaptureRow[],
  includeSecrets: boolean
): string {
  const secretLine = includeSecrets
    ? "> **SECRETS INCLUDED.** Live passwords, API keys and tokens are written so environments can be rebuilt. Store only in a password manager."
    : "> Secret values omitted (SET or empty). Re-download with **Include secrets** for full configuration values.";
  const lines: string[] = [
    "# NGX-Ramblers platform configuration values",
    "",
    `> Private · gitignored · generated ${generatedAtUtc}  `,
    secretLine,
    "",
    "Built from staging `config.environments` and each site Mongo `config` collection (`system`, `brevo`, `salesforce`, `committee`).",
    "",
    "## Regenerate",
    "",
    "From the staging platform admin UI: **Platform → Environment management → Platform Configuration Values**.",
    "",
    "```bash",
    "cd server && npm run ops:estate-rebuild-capture",
    "```",
    "",
    "## Third-party systems",
    "",
    "One row per system the platform integrates with. Function and information held are taken from how NGX actually uses each system.",
    "",
    "| System | Scope | Function | Information held in NGX config | Config paths |",
    "|--------|-------|----------|--------------------------------|--------------|"
  ];

  THIRD_PARTY_SYSTEMS.forEach(system => {
    lines.push(
      `| ${system.name} | ${system.scope} | ${system.function} | ${system.informationHeld} | \`${system.configPaths}\` |`
    );
  });

  lines.push(
    "",
    "## Field catalogue (per site)",
    "",
    "| Category | Field | Where it lives |",
    "|----------|-------|----------------|"
  );

  SITE_FIELDS.forEach(field => {
    lines.push(`| ${field.category} | ${field.label} (\`${field.fieldId}\`) | \`${field.whereHeld}\` |`);
  });

  lines.push(
    "",
    "## Platform values (from staging config.environments)",
    "",
    "| Category | Field | Configured? | Safe value / presence | Where it lives |",
    "|----------|-------|-------------|----------------------|----------------|"
  );
  platformRows.forEach(row => {
    lines.push(`| ${row.category} | ${row.field} (\`${row.fieldId}\`) | ${row.configured} | ${row.safeValue} | \`${row.whereHeld}\` |`);
  });

  lines.push(
    "",
    "## Sites directory",
    "",
    "| Environment | Group | Code | Public URL | Chairman | Webmaster | Contacts | Fly app | Mongo cluster | DB | AWS bucket |",
    "|-------------|-------|------|------------|----------|-----------|----------|---------|---------------|----|------------|"
  );
  infraList.forEach(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    const chairman = [site?.chairmanName, site?.chairmanEmail].filter(Boolean).join(" ");
    const webmaster = [site?.webmasterName, site?.webmasterEmail].filter(Boolean).join(" ");
    lines.push(
      `| ${infra.environment} | ${site?.groupLongName || ""} | ${site?.groupCode || ""} | ${site?.siteHref || ""} | ${chairman} | ${webmaster} | ${site?.siteContactsSummary || ""} | ${infra.flyAppName} | ${infra.mongoCluster} | ${infra.mongoDb} | ${infra.awsBucket} |`
    );
  });

  const snapshotCols: Array<{fieldId: string; label: string}> = [
    {fieldId: "googleMapsApiKey", label: "GMaps"},
    {fieldId: "osMapsApiKey", label: "OS"},
    {fieldId: "recaptchaSecretKey", label: "reCAPTCHA"},
    {fieldId: "brevoApiKey", label: "Brevo"},
    {fieldId: "wmApiKey", label: "WM"},
    {fieldId: "mongoPassword", label: "Mongo pwd"},
    {fieldId: "awsSecretAccessKey", label: "AWS secret"},
    {fieldId: "flyApiToken", label: "Fly token"},
    {fieldId: "facebookPageAccessToken", label: "FB token"},
    {fieldId: "meetupAccessToken", label: "Meetup"},
    {fieldId: "gmailClientSecret", label: "Gmail"},
    {fieldId: "vapidPrivateKey", label: "VAPID"}
  ];

  lines.push(
    "",
    "## Per-site configuration snapshot",
    "",
    "Legend: **Y** = present in live config. Blank = empty. **err** = probe failed.",
    "",
    `| Environment | ${snapshotCols.map(col => col.label).join(" | ")} |`,
    `|-------------${snapshotCols.map(() => "|------").join("")}|`
  );

  infraList.forEach(infra => {
    const site = probes.find(probe => probe.environment === infra.environment) as EstateRebuildSiteProbe;
    const cells = snapshotCols.map(col => {
      const value = safeValueFor(col.fieldId, infra, site, includeSecrets);
      if (value === "SET" || value === "Y") {
        return "Y";
      } else if (value.startsWith("ERROR")) {
        return "err";
      } else if (includeSecrets && value) {
        return "Y";
      } else {
        return "";
      }
    });
    lines.push(`| ${infra.environment} | ${cells.join(" | ")} |`);
  });

  lines.push(
    "",
    "## Counts",
    "",
    `- Sites: **${infraList.length}**`,
    `- Third-party systems: **${THIRD_PARTY_SYSTEMS.length}**`,
    `- Fields per site: **${SITE_FIELDS.length}**`,
    `- Site configuration rows: **${infraList.length * SITE_FIELDS.length}**`,
    `- Platform fields: **${PLATFORM_FIELDS.length}**`,
    ""
  );

  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(
  generatedAtUtc: string,
  infraList: EstateRebuildInfraSnapshot[],
  probes: EstateRebuildSiteProbe[],
  rows: EstateRebuildCaptureRow[],
  platformRowsData: EstateRebuildPlatformCaptureRow[],
  includeSecrets: boolean
): string {
  const siteOptions = infraList.map(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    return `<option value="${escapeHtml(infra.environment)}">${escapeHtml(infra.environment)} — ${escapeHtml(site?.groupLongName || "")}</option>`;
  }).join("\n");

  const dirRows = infraList.map(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    const href = site?.siteHref || "";
    const hrefCell = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`
      : "";
    return `<tr>
      <td><strong>${escapeHtml(infra.environment)}</strong></td>
      <td>${escapeHtml(site?.groupLongName || "")}</td>
      <td><code>${escapeHtml(site?.groupCode || "")}</code></td>
      <td>${hrefCell}</td>
      <td>${escapeHtml(site?.chairmanName || "")}${site?.chairmanEmail ? `<br><code>${escapeHtml(site.chairmanEmail)}</code>` : ""}</td>
      <td>${escapeHtml(site?.webmasterName || "")}${site?.webmasterEmail ? `<br><code>${escapeHtml(site.webmasterEmail)}</code>` : ""}</td>
      <td>${escapeHtml(site?.siteContactsSummary || "")}</td>
      <td><code>${escapeHtml(infra.flyAppName)}</code></td>
      <td><code>${escapeHtml(infra.mongoCluster)}</code></td>
      <td><code>${escapeHtml(infra.mongoDb)}</code></td>
      <td><code>${escapeHtml(infra.awsBucket)}</code></td>
    </tr>`;
  }).join("\n");

  const platformRows = platformRowsData.map(row =>
    `<tr>
      <td>${escapeHtml(row.category)}</td>
      <td><code>${escapeHtml(row.fieldId)}</code></td>
      <td>${escapeHtml(row.field)}</td>
      <td><span class="badge ${escapeHtml(row.configured)}">${escapeHtml(row.configured)}</span></td>
      <td>${escapeHtml(row.safeValue)}</td>
      <td><code>${escapeHtml(row.whereHeld)}</code></td>
    </tr>`
  ).join("\n");

  const dataJson = JSON.stringify(rows.map(row => ({
    environment: row.environment,
    group: row.group,
    layer: row.layer,
    category: row.category,
    fieldId: row.fieldId,
    field: row.field,
    configured: row.configured,
    safe: row.safeValue,
    where: row.whereHeld
  })));

  const presentCount = rows.filter(row => row.configured === EstateRebuildConfigured.PRESENT).length;
  const emptyCount = rows.filter(row => row.configured === EstateRebuildConfigured.EMPTY).length;
  const errorCount = rows.filter(row => row.configured === EstateRebuildConfigured.ERROR).length;
  const contactsFilled = infraList.filter(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    return !!(site?.chairmanEmail || site?.webmasterEmail);
  }).length;

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NGX-Ramblers Platform Configuration Values - Private</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="https://www.ramblers.org.uk/_nuxt/img/horiz-colour.8829dc8.svg">
  <style>
    :root {
      --ramblers-sunrise: rgb(249, 177, 4);
      --ramblers-sunrise-hover: rgb(211, 150, 3);
      --ramblers-mintcake: rgb(155, 200, 171);
      --ramblers-mintcake-hover: rgb(133, 173, 146);
      --ramblers-mintcake-deep: rgb(99, 134, 110);
      --ramblers-mintcake-light: rgba(175, 226, 194, 0.55);
      --ramblers-granite: rgb(64, 65, 65);
      --ramblers-cloudy: rgb(255, 255, 255);
      --ramblers-grey: rgb(222, 226, 230);
      --ramblers-black: rgb(33, 37, 41);
      --ramblers-rosycheeks: rgb(246, 176, 157);
      --ramblers-sunset: rgb(240, 128, 80);
      --ramblers-graphite: #3c3d3e;
      --bg-primary: #f6f7f7;
      --bg-secondary: #f0f1f1;
      --bg-card: var(--ramblers-cloudy);
      --text-primary: var(--ramblers-granite);
      --text-secondary: #4f5552;
      --text-muted: #6d7470;
      --border-color: rgba(64, 65, 65, 0.12);
      --border-strong: rgba(64, 65, 65, 0.2);
      --shadow: rgba(64, 65, 65, 0.08);
      --shadow-hover: rgba(64, 65, 65, 0.16);
      --header-bg: var(--ramblers-graphite);
      --footer-bg: var(--ramblers-graphite);
      --present-bg: rgba(155, 200, 171, 0.35);
      --empty-bg: rgba(246, 176, 157, 0.35);
      --manual-bg: rgba(249, 177, 4, 0.22);
      --error-bg: rgba(240, 128, 80, 0.28);
      --critical-bg: rgba(249, 177, 4, 0.18);
    }
    [data-theme="dark"] {
      --bg-primary: #1c1d1e;
      --bg-secondary: #262728;
      --bg-card: #2f3031;
      --text-primary: #f5f6f5;
      --text-secondary: #c5cdc8;
      --text-muted: #9aa39e;
      --border-color: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.18);
      --shadow: rgba(0, 0, 0, 0.35);
      --shadow-hover: rgba(0, 0, 0, 0.5);
      --header-bg: #151617;
      --footer-bg: #151617;
      --present-bg: rgba(155, 200, 171, 0.22);
      --empty-bg: rgba(246, 176, 157, 0.2);
      --manual-bg: rgba(249, 177, 4, 0.16);
      --error-bg: rgba(240, 128, 80, 0.22);
      --critical-bg: rgba(249, 177, 4, 0.14);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      color: var(--text-primary);
      transition: background 0.3s, color 0.3s;
    }
    .header {
      background: var(--header-bg);
      padding: 16px 30px;
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 3px solid var(--ramblers-sunrise);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 auto;
      max-width: none;
      width: 100%;
      gap: 16px;
      padding: 0 8px;
    }
    body.layout-site .header-inner {
      max-width: 1200px;
      padding: 0;
    }
    .header-logo { height: 50px; width: auto; }
    .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
    .header-badge {
      background: rgba(249, 177, 4, 0.18);
      color: var(--ramblers-sunrise);
      border: 1px solid rgba(249, 177, 4, 0.45);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .theme-toggle,
    .width-toggle {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 30px;
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--ramblers-cloudy);
      transition: all 0.3s;
      font-family: inherit;
    }
    .theme-toggle:hover,
    .width-toggle:hover {
      background: rgba(249, 177, 4, 0.18);
      border-color: rgba(249, 177, 4, 0.55);
    }
    .container {
      max-width: none;
      width: 100%;
      margin: 0 auto;
      padding: 0 20px 48px;
      transition: max-width 0.25s ease;
    }
    body.layout-site .container {
      max-width: 1200px;
    }
    .hero { text-align: center; padding: 36px 12px 20px; }
    .hero-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .hero-logo { max-width: 220px; width: 100%; height: auto; }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary);
    }
    .subtitle { color: var(--text-secondary); font-size: 1.05rem; margin-bottom: 6px; }
    .meta-line { color: var(--text-muted); font-size: 0.9rem; }
    .stats-hero {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin: 12px 0 28px;
    }
    .stat-card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      border: 1px solid var(--border-color);
      border-top: 4px solid var(--ramblers-sunrise);
      box-shadow: 0 2px 10px var(--shadow);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .stat-card:nth-child(2) { border-top-color: var(--ramblers-mintcake); }
    .stat-card:nth-child(3) { border-top-color: var(--ramblers-sunset); }
    .stat-card:nth-child(4) { border-top-color: var(--ramblers-rosycheeks); }
    .stat-card:nth-child(5) { border-top-color: var(--ramblers-mintcake-deep); }
    .stat-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 22px var(--shadow-hover);
    }
    .stat-value {
      font-size: 1.9rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .stat-card:first-child .stat-value { color: var(--ramblers-sunrise-hover); }
    [data-theme="dark"] .stat-card:first-child .stat-value { color: var(--ramblers-sunrise); }
    .stat-label {
      color: var(--text-secondary);
      margin-top: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .stat-detail {
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 4px;
    }
    .section {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 10px var(--shadow);
      margin-bottom: 24px;
    }
    .section h2 {
      margin-bottom: 18px;
      color: var(--text-primary);
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section h2::before {
      content: "";
      width: 4px;
      height: 22px;
      background: linear-gradient(180deg, var(--ramblers-sunrise), var(--ramblers-mintcake));
      border-radius: 2px;
      flex-shrink: 0;
    }
    .section-intro {
      color: var(--text-secondary);
      font-size: 0.92rem;
      line-height: 1.5;
      margin: -8px 0 16px;
    }
    .alert {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 20px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }
    .alert-warning {
      border-left: 4px solid var(--ramblers-sunrise);
      background: rgba(249, 177, 4, 0.12);
    }
    .alert strong { display: block; margin-bottom: 4px; font-weight: 700; }
    .alert p { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.45; }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: end;
      margin-bottom: 14px;
      padding: 14px;
      background: var(--bg-secondary);
      border-radius: 10px;
      border: 1px solid var(--border-color);
    }
    .controls label {
      display: flex;
      flex-direction: column;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      gap: 6px;
    }
    .controls select,
    .controls input {
      font: inherit;
      font-size: 0.9rem;
      font-weight: 400;
      text-transform: none;
      letter-spacing: normal;
      color: var(--text-primary);
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
      min-width: 11rem;
    }
    .controls select:focus,
    .controls input:focus {
      outline: 2px solid rgba(249, 177, 4, 0.55);
      border-color: var(--ramblers-sunrise);
    }
    .count-pill {
      margin-left: auto;
      background: var(--ramblers-mintcake-light);
      color: var(--ramblers-mintcake-deep);
      border: 1px solid rgba(99, 134, 110, 0.35);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 0.85rem;
      font-weight: 700;
      white-space: nowrap;
    }
    [data-theme="dark"] .count-pill {
      color: var(--ramblers-mintcake);
      background: rgba(155, 200, 171, 0.16);
    }
    .scroll {
      overflow: auto;
      max-height: 68vh;
      border: 1px solid var(--border-color);
      border-radius: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
    }
    th, td {
      border-bottom: 1px solid var(--border-color);
      padding: 0.55rem 0.6rem;
      text-align: left;
      vertical-align: top;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-weight: 700;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-bottom: 2px solid rgba(249, 177, 4, 0.4);
    }
    tr:hover td { background: rgba(155, 200, 171, 0.08); }
    code {
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 0.82em;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
    a { color: var(--ramblers-mintcake-deep); font-weight: 600; }
    [data-theme="dark"] a { color: var(--ramblers-mintcake); }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 9px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .present { background: var(--present-bg); color: var(--ramblers-mintcake-deep); }
    .empty { background: var(--empty-bg); color: #8a4b3a; }
    .manual { background: var(--manual-bg); color: #7a5a00; }
    .error { background: var(--error-bg); color: #8a3a1a; }
    .req-critical { background: var(--critical-bg); font-weight: 700; color: var(--text-primary); }
    .req-recommended { color: var(--text-secondary); }
    .req-if-used, .req-identity { color: var(--text-muted); }
    [data-theme="dark"] .present { color: var(--ramblers-mintcake); }
    [data-theme="dark"] .empty { color: var(--ramblers-rosycheeks); }
    [data-theme="dark"] .manual { color: var(--ramblers-sunrise); }
    [data-theme="dark"] .error { color: var(--ramblers-sunset); }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 600;
    }
    .footer {
      background: var(--footer-bg);
      color: rgba(255, 255, 255, 0.75);
      text-align: center;
      padding: 22px 16px 28px;
      font-size: 0.85rem;
      border-top: 3px solid var(--ramblers-sunrise);
    }
    .footer strong { color: var(--ramblers-sunrise); }
    @media (max-width: 900px) {
      .stats-hero { grid-template-columns: repeat(2, 1fr); }
      h1 { font-size: 1.55rem; }
      .count-pill { margin-left: 0; }
    }
    @media (max-width: 520px) {
      .stats-hero { grid-template-columns: 1fr; }
      .header { padding: 12px 16px; }
      .header-logo { height: 40px; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <div class="header-left">
        <img src="https://www.ngx-ramblers.org.uk/api/aws/s3/logos/21b1e74f-f0f0-4ad3-9bf4-6d894ed02fcd.png" alt="NGX Ramblers" class="header-logo">
      </div>
      <div class="header-right">
        <span class="header-badge">${includeSecrets ? "Private · secrets included" : "Private · secrets omitted"}</span>
        <button class="width-toggle" type="button" onclick="toggleWidth()" aria-label="Toggle full width layout" title="Switch between full width and website-width layout">
          <span class="icon" id="widthIcon">⛶</span>
          <span class="label" id="widthLabel">Full width</span>
        </button>
        <button class="theme-toggle" type="button" onclick="toggleTheme()" aria-label="Toggle colour theme">
          <span class="icon" id="themeIcon">☀️</span>
          <span class="label" id="themeLabel">Light</span>
        </button>
      </div>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <div class="hero-title">
        <img src="https://www.ramblers.org.uk/_nuxt/img/horiz-colour.8829dc8.svg" alt="Ramblers logotype" class="hero-logo" loading="lazy">
        <h1>Platform Configuration Values</h1>
      </div>
      <p class="subtitle">Factual inventory of every NGX-Ramblers site from live config</p>
      <p class="meta-line">Generated ${escapeHtml(generatedAtUtc)} · staging config.environments + each site Mongo config collection</p>
    </div>

    <div class="stats-hero">
      <div class="stat-card">
        <div class="stat-value">${infraList.length}</div>
        <div class="stat-label">Sites</div>
        <div class="stat-detail">Live environments</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${SITE_FIELDS.length}</div>
        <div class="stat-label">Fields / site</div>
        <div class="stat-detail">${rows.length} configuration rows</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${presentCount}</div>
        <div class="stat-label">Present</div>
        <div class="stat-detail">Values found</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${emptyCount}</div>
        <div class="stat-label">Empty</div>
        <div class="stat-detail">Not set</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${contactsFilled}</div>
        <div class="stat-label">With contacts</div>
        <div class="stat-detail">Chairman or webmaster</div>
      </div>
    </div>

    <div class="alert alert-warning">
      <div>
        <strong>${includeSecrets ? "Private · secrets included" : "Private · secrets omitted"}</strong>
        <p>
          Every row is read from staging <code>config.environments</code> or a site Mongo <code>config</code> document.
          ${includeSecrets
    ? "Live passwords, API keys and tokens are written so environments can be rebuilt. Store only in a password manager; do not commit or email."
    : "Secrets show as SET or empty. Re-download with <strong>Include secrets</strong> for full configuration values."}
        </p>
      </div>
    </div>

    <section class="section">
      <h2>Third-party systems</h2>
      <p class="section-intro">One row per system NGX integrates with: what it does, what config holds, and the real config paths.</p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>System</th><th>Scope</th><th>Function</th><th>Information held in NGX config</th><th>Config paths</th>
            </tr>
          </thead>
          <tbody>
            ${THIRD_PARTY_SYSTEMS.map(system => `<tr>
              <td><strong>${escapeHtml(system.name)}</strong><br><code>${escapeHtml(system.systemId)}</code></td>
              <td>${escapeHtml(system.scope)}</td>
              <td>${escapeHtml(system.function)}</td>
              <td>${escapeHtml(system.informationHeld)}</td>
              <td><code>${escapeHtml(system.configPaths)}</code></td>
            </tr>`).join("\n")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Sites directory</h2>
      <p class="section-intro">One row per environment, with chairman and webmaster contacts from committee settings.</p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Environment</th><th>Group</th><th>Code</th><th>Public URL</th>
              <th>Chairman</th><th>Webmaster</th><th>Contacts</th>
              <th>Fly app</th><th>Mongo cluster</th><th>DB</th><th>AWS bucket</th>
            </tr>
          </thead>
          <tbody>${dirRows}</tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Site values</h2>
      <p class="section-intro">One row per site × field from live config. Filter by environment, layer, or configuration status.</p>
      <div class="legend">
        <span><span class="badge present">present</span> found in live config</span>
        <span><span class="badge empty">empty</span> not set</span>
        <span><span class="badge error">error</span> probe failed</span>
      </div>
      <div class="controls">
        <label>Environment
          <select id="envFilter">
            <option value="">All sites</option>
            ${siteOptions}
          </select>
        </label>
        <label>Layer
          <select id="layerFilter">
            <option value="">All layers</option>
            <option value="runtime">runtime</option>
            <option value="application">application</option>
            <option value="people">people</option>
            <option value="console">console</option>
          </select>
        </label>
        <label>Configured?
          <select id="cfgFilter">
            <option value="">All</option>
            <option value="present">present</option>
            <option value="empty">empty</option>
            <option value="error">error</option>
          </select>
        </label>
        <label>Search
          <input id="q" type="search" placeholder="field, category, group…" />
        </label>
        <div class="count-pill" id="count"></div>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Environment</th><th>Group</th><th>Layer</th><th>Category</th><th>Field</th>
              <th>Configured?</th><th>Safe value / presence</th><th>Where it lives</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Platform values</h2>
      <p class="section-intro">Shared values from staging <code>config.environments</code> (top-level aws, cloudflare, ai, secrets, uploadWorker).</p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Category</th><th>Field ID</th><th>Field</th><th>Configured?</th><th>Safe value / presence</th><th>Where it lives</th>
            </tr>
          </thead>
          <tbody>${platformRows}</tbody>
        </table>
      </div>
    </section>
  </div>

  <footer class="footer">
    <strong>NGX-Ramblers</strong> · private operations document · ${escapeHtml(generatedAtUtc)} ·
    ${PLATFORM_FIELDS.length} platform fields · empty: ${emptyCount} · probe errors: ${errorCount}
  </footer>

  <script>
    const ROWS = ${dataJson};
    const tbody = document.getElementById("tbody");
    const envFilter = document.getElementById("envFilter");
    const layerFilter = document.getElementById("layerFilter");
    const cfgFilter = document.getElementById("cfgFilter");
    const q = document.getElementById("q");
    const count = document.getElementById("count");

    function applyWidthLayout(mode) {
      const full = mode !== "site";
      if (full) {
        document.body.classList.remove("layout-site");
        document.getElementById("widthIcon").textContent = "⛶";
        document.getElementById("widthLabel").textContent = "Full width";
      } else {
        document.body.classList.add("layout-site");
        document.getElementById("widthIcon").textContent = "❐";
        document.getElementById("widthLabel").textContent = "Site width";
      }
      try { localStorage.setItem("estate-rebuild-width", full ? "full" : "site"); } catch (e) {}
    }

    function toggleWidth() {
      const isSite = document.body.classList.contains("layout-site");
      applyWidthLayout(isSite ? "full" : "site");
    }

    function toggleTheme() {
      const html = document.documentElement;
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      if (next === "dark") {
        html.setAttribute("data-theme", "dark");
        document.getElementById("themeIcon").textContent = "🌙";
        document.getElementById("themeLabel").textContent = "Dark";
      } else {
        html.removeAttribute("data-theme");
        document.getElementById("themeIcon").textContent = "☀️";
        document.getElementById("themeLabel").textContent = "Light";
      }
      try { localStorage.setItem("estate-rebuild-theme", next); } catch (e) {}
    }

    (function restorePreferences() {
      try {
        if (localStorage.getItem("estate-rebuild-theme") === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
          document.getElementById("themeIcon").textContent = "🌙";
          document.getElementById("themeLabel").textContent = "Dark";
        }
        if (localStorage.getItem("estate-rebuild-width") === "site") {
          applyWidthLayout("site");
        } else {
          applyWidthLayout("full");
        }
      } catch (e) {
        applyWidthLayout("full");
      }
    })();

    function render() {
      const env = envFilter.value;
      const layer = layerFilter.value;
      const cfg = cfgFilter.value;
      const query = q.value.trim().toLowerCase();
      const filtered = ROWS.filter(function(r) {
        if (env && r.environment !== env) return false;
        if (layer && r.layer !== layer) return false;
        if (cfg && r.configured !== cfg) return false;
        if (query) {
          const hay = (r.environment + " " + r.group + " " + r.layer + " " + r.category + " " + r.field + " " + r.fieldId + " " + r.where + " " + (r.safe || "")).toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });
      count.textContent = filtered.length + " rows";
      tbody.innerHTML = filtered.map(function(r) {
        const safe = String(r.safe || "").replace(/</g, "&lt;");
        return "<tr>"
          + "<td><strong>" + r.environment + "</strong></td>"
          + "<td>" + (r.group || "") + "</td>"
          + "<td><span class=\\"badge present\\">" + r.layer + "</span></td>"
          + "<td>" + r.category + "</td>"
          + "<td>" + r.field + "<br><code>" + r.fieldId + "</code></td>"
          + "<td><span class=\\"badge " + r.configured + "\\">" + r.configured + "</span></td>"
          + "<td>" + safe + "</td>"
          + "<td><code>" + r.where + "</code></td>"
          + "</tr>";
      }).join("");
    }
    [envFilter, layerFilter, cfgFilter, q].forEach(function(el) { el.addEventListener("input", render); });
    render();
  </script>
</body>
</html>
`;
  return html;
}

function buildSiteDirectory(
  infraList: EstateRebuildInfraSnapshot[],
  probes: EstateRebuildSiteProbe[]
): EstateRebuildSiteDirectoryRow[] {
  return infraList.map(infra => {
    const site = probes.find(probe => probe.environment === infra.environment);
    return {
      environment: infra.environment,
      group: site?.groupLongName || "",
      groupCode: site?.groupCode || "",
      areaCode: site?.areaCode || "",
      siteHref: site?.siteHref || "",
      flyAppName: infra.flyAppName,
      mongoCluster: infra.mongoCluster,
      mongoDb: infra.mongoDb,
      mongoUsername: infra.mongoUsername,
      awsBucket: infra.awsBucket,
      awsRegion: infra.awsRegion,
      customDomains: infra.customDomains.join(", "),
      mailProvider: site?.mailProvider || "",
      chairmanName: site?.chairmanName || "",
      chairmanEmail: site?.chairmanEmail || "",
      webmasterName: site?.webmasterName || "",
      webmasterEmail: site?.webmasterEmail || "",
      siteContactsSummary: site?.siteContactsSummary || "",
      ngxLite: !!infra.ngxLite,
      probeStatus: site?.error ? "error" : "ok"
    };
  });
}

async function loadEstateRebuildData(
  options: EstateRebuildGenerateOptions = {includeSecrets: true}
): Promise<{
  generatedAtUtc: string;
  includeSecrets: boolean;
  infraList: EstateRebuildInfraSnapshot[];
  probes: EstateRebuildSiteProbe[];
  rows: EstateRebuildCaptureRow[];
  platformRows: EstateRebuildPlatformCaptureRow[];
}> {
  const includeSecrets = options.includeSecrets !== false;
  const generatedAtUtc = formatDateTime(dateTimeNow(), UIDateFormat.DISPLAY_DATE_AND_TIME);
  debugLog("Loading environments from platform config database… includeSecrets=%s", includeSecrets);
  const environmentsConfig = await configuredEnvironments();
  const environments = environmentsConfig.environments || [];
  const infraList = environments.map(infraFrom);
  const platform = platformFrom(environmentsConfig);
  const platformRows = buildPlatformRows(platform, includeSecrets);
  debugLog("%d environments, %d fields each → %d site rows", infraList.length, SITE_FIELDS.length, infraList.length * SITE_FIELDS.length);
  const probes: EstateRebuildSiteProbe[] = [];
  for (const env of environments) {
    debugLog("  probing %s…", env.environment);
    probes.push(await probeSite(env));
  }
  const rows = buildCaptureRows(infraList, probes, includeSecrets);
  return {generatedAtUtc, includeSecrets, infraList, probes, rows, platformRows};
}

export async function generateEstateRebuildInventory(
  options: EstateRebuildGenerateOptions = {includeSecrets: false}
): Promise<EstateRebuildInventory> {
  const data = await loadEstateRebuildData(options);
  return {
    generatedAtUtc: data.generatedAtUtc,
    includeSecrets: data.includeSecrets,
    siteCount: data.infraList.length,
    fieldsPerSite: SITE_FIELDS.length,
    siteCaptureRows: data.rows.length,
    platformFieldCount: PLATFORM_FIELDS.length,
    thirdPartySystems: THIRD_PARTY_SYSTEMS,
    sites: buildSiteDirectory(data.infraList, data.probes),
    siteCapture: data.rows,
    platformCapture: data.platformRows
  };
}

export async function generateEstateRebuildArtifacts(
  options: EstateRebuildGenerateOptions = {includeSecrets: true}
): Promise<EstateRebuildArtifacts> {
  const data = await loadEstateRebuildData(options);
  debugLog("Building workbook…");
  const xlsx = await buildWorkbook(data.generatedAtUtc, data.infraList, data.probes, data.rows, data.platformRows, data.includeSecrets);
  debugLog("Building markdown…");
  const markdown = buildMarkdown(data.generatedAtUtc, data.infraList, data.probes, data.platformRows, data.includeSecrets);
  debugLog("Building HTML…");
  const html = buildHtml(data.generatedAtUtc, data.infraList, data.probes, data.rows, data.platformRows, data.includeSecrets);
  const suffix = data.includeSecrets ? "-with-secrets" : "";
  return {
    generatedAtUtc: data.generatedAtUtc,
    siteCount: data.infraList.length,
    fieldsPerSite: SITE_FIELDS.length,
    siteCaptureRows: data.rows.length,
    platformFieldCount: PLATFORM_FIELDS.length,
    includeSecrets: data.includeSecrets,
    xlsx,
    markdown,
    html,
    xlsxFileName: `platform-configuration-values${suffix}.xlsx`,
    markdownFileName: `platform-configuration-values${suffix}.md`,
    htmlFileName: `platform-configuration-values${suffix}.html`
  };
}

export async function generateEstateRebuildCapture(options?: {
  writeToDisk?: boolean;
  includeSecrets?: boolean;
}): Promise<EstateRebuildGenerationResult> {
  const includeSecrets = options?.includeSecrets !== false;
  const artifacts = await generateEstateRebuildArtifacts({includeSecrets});
  const writeToDisk = options?.writeToDisk === true;
  if (writeToDisk) {
    mkdirSync(OPS_DIR, {recursive: true});
    const xlsxPath = resolveClientPath("non-vcs", "ops", artifacts.xlsxFileName);
    const mdPath = resolveClientPath("non-vcs", "ops", artifacts.markdownFileName);
    const htmlPath = resolveClientPath("non-vcs", "ops", artifacts.htmlFileName);
    writeFileSync(xlsxPath, new Uint8Array(artifacts.xlsx));
    writeFileSync(mdPath, artifacts.markdown, "utf-8");
    writeFileSync(htmlPath, artifacts.html, "utf-8");
    return {
      ...artifacts,
      xlsxPath,
      markdownPath: mdPath,
      htmlPath
    };
  } else {
    return {
      ...artifacts,
      xlsxPath: null,
      markdownPath: null,
      htmlPath: null
    };
  }
}

if (require.main === module) {
  generateEstateRebuildCapture({writeToDisk: true})
    .then(result => {
      debugLog("Done.");
      debugLog("  sites: %d", result.siteCount);
      debugLog("  site configuration rows: %d", result.siteCaptureRows);
      debugLog("  %s", result.xlsxPath);
      debugLog("  %s", result.markdownPath);
      debugLog("  %s", result.htmlPath);
      process.exit(0);
    })
    .catch(error => {
      debugLog("Failed: %s", error?.stack || error);
      process.exit(1);
    });
}

export function fingerprint(value: string): string {
  if (!value) {
    return "";
  } else {
    return createHash("sha256").update(value).digest("hex").slice(0, 10);
  }
}
