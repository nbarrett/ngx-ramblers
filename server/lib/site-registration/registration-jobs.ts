import debug from "debug";
import { randomUUID } from "crypto";
import { REGISTRATION_STAGE_LABELS, REGISTRATION_SYSTEM_ACTOR, RegistrationEmailType, RegistrationHistoryAction, RegistrationJobStage, RegistrationNavbarPath, RegistrationPage, RegistrationPlan, RegistrationStageKey, RegistrationState, RegistrationStep, RegistrationWalkCandidate, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { createEmptySetupRequest, environmentNameForGroup, prefixedEnvironmentResourceName, SetupStepStatus } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { ADMIN_SET_PASSWORD_PATH, EventPopulation, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ensureRegistrationIndexes, recordRegistrationHistory, registrations, registrationSettings } from "./registration-store";
import { assertRegistrationEditable } from "./registration-policy";
import { registrationForToken } from "./registration-service";
import { earlierImportFilters, importedPagePath, withRowsUnderHeading, pairedImageRows, registrationMigrationConfig, withContactUsLinks, withIntroductionPhotos, withoutButtonsTo, withoutEmptyRows, withPageHeading, withSourcePageAlbums } from "./registration-content";
import { contentMetadata } from "../mongo/models/content-metadata";
import { createEnvironment } from "../environment-setup/environment-setup-service";
import { environmentDetails } from "../environment-setup/environment-details";
import { createEnvironmentMongoUser, platformAtlasAccess, waitForMongoLogin } from "../environment-setup/mongo-database-user";
import { resumeEnvironment } from "../cli";
import { connectToEnvironmentMongo, EnvironmentMongoConnection, loadEnvironmentContext } from "../environment-setup/environment-context";
import { findEnvironmentFromDatabase, setEnvironmentEstateDeploy } from "../environments/environments-config";
import { createAdminMember } from "../environment-setup/templates/sample-data/admin-member-template";
import { systemConfig } from "../config/system-config";
import { registrationPhotoTemplates, scrapeRegistrationSite } from "./registration-import-scrape";
import { registrationFailureMessage, registrationProgressLineFailed, sanitiseRegistrationMessage } from "../../../projects/ngx-ramblers/src/app/functions/registration-progress";
import { dateTimeNowAsValue } from "../shared/dates";
import { sendRegistrationEmail } from "../brevo/transactional-mail/send-site-registration-email";
import { registerScheduledTask } from "../cron/scheduled-task-registry";
import { envConfig } from "../env-config/env-config";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { syncWalksManagerData } from "../walks/walks-manager-sync";
import { walksManagerSyncModelsFor } from "../walks/walks-manager-sync-models";
import { walksManagerSyncEnabled } from "../../../projects/ngx-ramblers/src/app/functions/walks/walks-manager-sync-config";
import { buildMongoUri } from "../shared/mongodb-uri";
import { registrationToken } from "./registration-policy";
import { fetchRamblersGroupsFromApi } from "../ramblers/list-groups";
import * as registrationLogos from "./registration-logos";
import { ensureOsMapsApiKey } from "../os-maps/provision-os-maps-key";
import { applyTextExclusions, collapseExcessBlankLines } from "../migration/text-exclusions";
import { aiConfigFromEnvironment } from "../ai/ai-config";
import { generate, MAX_GENERATED_TOKENS } from "../ai/ai-generation";
import { tidiedText } from "../ai/description-tidy";
import { TidyTextKind } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { assembleRegistrationPages, isRegistrationFeaturePath } from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import {
  ImageFit, IndexContentType, IndexRenderMode, PageContent, PageContentColumn, PageContentRow, PageContentType, StringMatch
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {migrateRegistrationAssets} from "./registration-assets";
import { documentMarkdown, isDocumentUrl } from "./registration-documents";
import { ramblersHostedContactPhone, registrationHeaderButtons } from "./registration-content";
import { fetchPublicSiteHtml } from "./public-site-fetch";
import { RegistrationSiteFlavour } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {importRegistrationCommittee} from "./registration-committee";
import {createAllSamplePageContent, PRIVACY_POLICY_PATH} from "../environment-setup/templates/sample-data/page-content-templates";
import {COMMITTEE_ROOT_PATH} from "../environment-setup/templates/sample-data/committee-page-template";
import {toGroupShortName} from "../environment-setup/database-initialiser";
import { EnvironmentConfig, FLYIO_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { albumsLinkedToWalks, homeContentRows, photosByYear, registrationKeyAreas } from "./registration-photos";
import { pluraliseWithCount } from "../shared/string-utils";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { ScheduledTaskId } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";

const debugLog = debug(envConfig.logNamespace("site-registration:jobs"));
const workerId = randomUUID();
const running = {active: false, registrationId: null as string | null};
export const REGISTRATION_STOPPED_MESSAGE = "Stopped by the platform reviewer.";
const LANDING_IMAGE_MAX_HEIGHT = 400;

async function leasedByThisWorker(id: string): Promise<boolean> {
  const current = await registrations().findOne({id}, {projection: {leaseOwner: 1}});
  return current?.leaseOwner === workerId;
}

async function assertStillLeased(id: string): Promise<void> {
  if (!await leasedByThisWorker(id)) {
    throw new Error(REGISTRATION_STOPPED_MESSAGE);
  }
}
const LEASE_MS = 5 * 60 * 1000;
const LEASE_HEARTBEAT_MS = 60000;

function leaseHeartbeat(id: string): NodeJS.Timeout {
  const timer = setInterval(() => {
    registrations().updateOne({id, leaseOwner: workerId}, {$set: {leaseUntil: dateTimeNowAsValue() + LEASE_MS, updatedAt: dateTimeNowAsValue()}})
      .catch(error => debugLog("lease heartbeat for %s failed: %s", id, error.message));
  }, LEASE_HEARTBEAT_MS);
  timer.unref();
  return timer;
}

function pushProgress(registration: StoredSiteRegistration, step: string, status: SetupStepStatus, message: string, limit = 100) {
  return registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
    $push: {progress: {$each: [{step, status, message, timestamp: dateTimeNowAsValue()}], $slice: -limit}},
    $set: {updatedAt: dateTimeNowAsValue(), leaseUntil: dateTimeNowAsValue() + LEASE_MS}
  });
}

async function stageFinished(registration: StoredSiteRegistration, key: RegistrationStageKey, action: RegistrationHistoryAction): Promise<void> {
  await recordRegistrationHistory(registration.id, action, REGISTRATION_SYSTEM_ACTOR);
  await pushProgress(registration, REGISTRATION_STAGE_LABELS[key].done, SetupStepStatus.Completed, `${REGISTRATION_STAGE_LABELS[key].done}: this stage is finished`);
}

export async function submitRegistration(token: string): Promise<void> {
  await submitRegistrationDraft(await registrationForToken(token));
}

export async function submitRegistrationDraft(registration: StoredSiteRegistration): Promise<void> {
  assertRegistrationEditable(registration);
  const settings = await registrationSettings();
  const environmentName = environmentNameForGroup(registration.group.name) || registration.group.group_code.toLowerCase();
  if (!settings.enabled || !settings.sourceEnvironmentName || !settings.reviewer.email || !settings.senderEmail) {
    throw new Error("Registration provisioning is not configured yet. Your answers have been saved.");
  } else if (await findEnvironmentFromDatabase(environmentName)) {
    throw new Error("An environment already exists for this group. Please contact the platform administrator.");
  } else {
    const migrationConfig = registration.plan === RegistrationPlan.FULL ? registrationMigrationConfig(registration, settings.sourceFidelityValidationEnabled) : null;
    await registrations().updateOne({id: registration.id, state: RegistrationState.DRAFT}, {$set: {
      state: RegistrationState.QUEUED, currentStep: RegistrationStep.PROGRESS, migrationConfig,
      environmentName, updatedAt: dateTimeNowAsValue()
    }});
    await recordRegistrationHistory(registration.id, RegistrationHistoryAction.SUBMITTED, registration.email);
  }
}

async function provisionRegistration(registration: StoredSiteRegistration): Promise<void> {
  const settings = await registrationSettings();
  const details = await environmentDetails(settings.sourceEnvironmentName);
  const currentSystem = await systemConfig();
  const defaults = createEmptySetupRequest();
  const name = registration.environmentName;
  const area = (await fetchRamblersGroupsFromApi([registration.group.area_code])).find(candidate => candidate.scope === "A");
  const database = prefixedEnvironmentResourceName(name, 38);
  const mongoUser = await createEnvironmentMongoUser(await platformAtlasAccess(), database, name);
  await waitForMongoLogin(details.serviceConfigs.mongodb.cluster, mongoUser, database, attempt => {
    void pushProgress(registration, "MongoDB", attempt ? SetupStepStatus.Running : SetupStepStatus.Completed,
      attempt ? `Waiting for MongoDB Atlas to activate the database user ${mongoUser.username} (check ${attempt})` : `Database user ${mongoUser.username} is ready`);
  });
  const request = {
    ...defaults,
    ramblersInfo: {areaCode: registration.group.area_code, areaName: area?.name || registration.group.area_code,
      groupCode: registration.group.group_code, groupName: registration.group.name, groupData: registration.group, areaData: area},
    environmentBasics: {...defaults.environmentBasics, ...details.environmentBasics,
      memory: FLYIO_DEFAULTS.MEMORY, scaleCount: FLYIO_DEFAULTS.SCALE_COUNT, environmentName: name,
      appName: prefixedEnvironmentResourceName(name, 30)},
    serviceConfigs: {...defaults.serviceConfigs, ...details.serviceConfigs,
      aws: {...details.serviceConfigs.aws, bucket: prefixedEnvironmentResourceName(name, 63)},
      mongodb: {cluster: details.serviceConfigs.mongodb.cluster, username: mongoUser.username, password: mongoUser.password, database},
      ramblers: {apiKey: currentSystem.national.walksManager.apiKey},
      brevo: {apiKey: ""},
      osMaps: {apiKey: ""}},
    adminUser: settings.reviewer,
    options: {...defaults.options, setupSubdomain: true, ngxLite: registration.plan === RegistrationPlan.LITE, estateDeploy: false, copyStandardAssets: false}
  };
  const existing = await findEnvironmentFromDatabase(name);
  const mongoUri = envConfig.mongo().uri.replace(/^"|"$/g, "");
  const platform = mongoUri.startsWith("mongodb") ? new MongoClient(mongoUri) : null;
  if (platform) {
    await platform.connect();
  }
  const progressWrites: Promise<unknown>[] = [];
  const report = progress => {
    const update = {
      $push: {progress: {$each: [{...progress, timestamp: progress.timestamp || dateTimeNowAsValue()}], $slice: -400}},
      $set: {updatedAt: dateTimeNowAsValue(), leaseUntil: dateTimeNowAsValue() + LEASE_MS}
    };
    const write = platform
      ? platform.db().collection<StoredSiteRegistration>("siteRegistrations").updateOne({id: registration.id, leaseOwner: workerId}, update)
      : registrations().updateOne({id: registration.id, leaseOwner: workerId}, update);
    progressWrites.push(write);
    return write;
  };
  try {
    await report({step: "Provision", status: SetupStepStatus.Running, message: existing ? "Resuming the existing review site" : "Creating the review site"});
    if (existing) {
      const context = await loadEnvironmentContext(name);
      const connection = await connectToEnvironmentMongo(context.envConfigData);
      try {
        const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
        if (system?.value?.group?.groupCode !== registration.group.group_code) {
          throw new Error("Existing environment has no matching group configuration. Repair it in Environment Setup before retrying.");
        }
      } finally {
        await connection.client.close();
      }
      await resumeEnvironment(name, {runDbInit: false, runFlyDeployment: true}, report);
    } else {
      await createEnvironment(request, report);
    }
  } finally {
    await Promise.all(progressWrites);
    if (platform) {
      await platform.close();
    }
  }
  const logo = await registrationLogos.applyRamblersDirectoryLogo(registration, area?.name || "");
  await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {
    provisionedAt: dateTimeNowAsValue(), siteUrl: `https://${name}.ngx-ramblers.org.uk`
  }, $push: {progress: {$each: [{
    step: "Group logo",
    status: SetupStepStatus.Completed,
    message: logo ? `Using ${logo.displayName}` : "No matching Ramblers directory logo",
    timestamp: dateTimeNowAsValue()
  }], $slice: -100}}});
}

async function reviewSiteSystemConfig(connection: EnvironmentMongoConnection, wantsEvents: boolean): Promise<SystemConfig> {
  try {
    if (wantsEvents) {
      await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {"value.group.socialEventPopulation": EventPopulation.WALKS_MANAGER}});
    }
    const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
    return system?.value;
  } finally {
    await connection.client.close();
  }
}

async function loadWalksFromWalksManager(registration: StoredSiteRegistration): Promise<void> {
  const context = await loadEnvironmentContext(registration.environmentName);
  const wantsEvents = (registration.proposedNavigation || []).some(item => item.path === RegistrationNavbarPath.EVENTS);
  const config = await reviewSiteSystemConfig(await connectToEnvironmentMongo(context.envConfigData), wantsEvents);
  if (!walksManagerSyncEnabled(config) || !context.envConfigData?.mongo?.cluster) {
    await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
      $push: {progress: {$each: [{step: "Walks Manager", status: SetupStepStatus.Completed, message: "Skipped - this site does not load walks from Walks Manager", timestamp: dateTimeNowAsValue()}], $slice: -100}},
      $set: {walksLoadedAt: dateTimeNowAsValue(), updatedAt: dateTimeNowAsValue()}
    });
  } else {
    const mongo = context.envConfigData.mongo;
    const uri = buildMongoUri({cluster: mongo.cluster, username: mongo.username || "", password: mongo.password || "", database: mongo.db});
    await pushProgress(registration, "Walks Manager", SetupStepStatus.Running, "Loading the full Walks Manager programme");
    const reviewSite = mongoose.createConnection(uri);
    try {
      await reviewSite.asPromise();
      const result = await syncWalksManagerData(config, {fullSync: true}, null, walksManagerSyncModelsFor(reviewSite));
      if (result.errors.length) {
        throw new Error(`Walks Manager load finished with errors: ${result.errors.join("; ")}`);
      } else {
        await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
          $push: {progress: {$each: [{step: "Walks Manager", status: SetupStepStatus.Completed, message: `Loaded ${result.totalProcessed} items from Walks Manager (${result.added} new)`, timestamp: dateTimeNowAsValue()}], $slice: -100}},
          $set: {walksLoadedAt: dateTimeNowAsValue(), updatedAt: dateTimeNowAsValue()}
        });
      }
    } finally {
      await reviewSite.close();
    }
  }
}

async function importRegistration(savedRegistration: StoredSiteRegistration): Promise<void> {
  const settings = await registrationSettings();
  const photoTemplates = await registrationPhotoTemplates();
  const migration = registrationMigrationConfig(savedRegistration, settings.sourceFidelityValidationEnabled);
  const registration = {...savedRegistration, migrationConfig: migration};
  await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {migrationConfig: migration}});
  const context = await loadEnvironmentContext(registration.environmentName);
  const migrationConnection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    await migrationConnection.db.collection("config").updateOne({key: ConfigKey.MIGRATION}, {$set: {value: {sites: [{...migration, persistData: true, uploadTos3: false, enabled: false}]}}}, {upsert: true});
  } finally {
    await migrationConnection.client.close();
  }
  const importProgress = (message: string) => {
    if (!/resource failed|resource load error|net::ERR/i.test(message)) {
      const status = /✅|migrated/i.test(message) ? SetupStepStatus.Completed
        : registrationProgressLineFailed(message) ? SetupStepStatus.Failed
        : /skipped/i.test(message) ? SetupStepStatus.Completed
        : SetupStepStatus.Running;
      pushProgress(registration, "Import", status, sanitiseRegistrationMessage(message), 400)
        .catch(error => debugLog("import progress write failed: %s", error.message));
    }
  };
  const result = await scrapeRegistrationSite({
    ...migration,
    persistData: false,
    requireSourceFidelity: migration.requireSourceFidelity,
    uploadTos3: false
  }, importProgress, registration.id);
  const documentPages = await importedDocumentPages(registration, importProgress);
  const scrapedPages = [...result.pageContents, ...documentPages];
  const imported = scrapedPages.filter(page => page.path && page.rows?.length);
  if (!imported.length) {
    throw new Error("No pages could be imported from the current website.");
  }
  const assembled = registrationNavigationPages(registration);
  importProgress("Tidying the imported text for spelling, grammar and old-site clutter");
  const preparedPages = await Promise.all(scrapedPages.map(async page => {
    const targetPath = importedPagePath(page.path, registration.pages || [], assembled);
    const title = targetPath === RegistrationNavbarPath.HOME ? registration.group.name : assembled.find(item => item.path === targetPath)?.title;
    const titledPage = withPageHeading({...page, path: targetPath}, title);
    const pageWithNavigation = assembled.some(sourcePage => sourcePage.parentPath === targetPath) ? withChildNavigation(titledPage) : titledPage;
    const hasAlbum = result.albums.some(album => album.sourcePagePath === page.path);
    const flattenedPage = {...pageWithNavigation, rows: pairedImageRows(cleanPageRows(pageWithNavigation.rows, targetPath))};
    const landingPage = !hasAlbum && assembled.some(item => !item.parentPath && item.path === targetPath) ? withLandingVisual(flattenedPage) : flattenedPage;
    return {...landingPage, rows: await tidyPageRows(landingPage.rows)};
  }));
  const uploadBucket = context.envConfigData.aws?.bucket;
  if (!uploadBucket) {
    throw new Error("The review site's file storage is not configured, so linked documents cannot be imported safely.");
  }
  const assetsMigrated = await migrateRegistrationAssets(registration, preparedPages, result.albums, uploadBucket, importProgress);
  const walkLinks = albumsLinkedToWalks(assetsMigrated.albums, registration.pages || [], await registrationWalks(context.envConfigData));
  const linkedCount = walkLinks.links.filter(link => link.walk).length;
  importProgress(`Linked ${linkedCount} of ${pluraliseWithCount(walkLinks.links.length, "photo album")} to walks from Walks Manager, so they appear on the photo maps`);
  walkLinks.links.filter(link => !link.walk).forEach(link => importProgress(`Skipped linking ${link.albumTitle} to a walk: ${link.reason}`));
  const migrated = {...assetsMigrated, albums: walkLinks.albums};
  const informationPages = assembled.some(page => page.parentPath === RegistrationNavbarPath.INFORMATION) ? [withChildNavigation({
    path: RegistrationNavbarPath.INFORMATION,
    rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "## Information"}]}]
  })] : [];
  const sourcePages = withSourcePageAlbums(migrated.pages.map(page => ({...page, rows: withoutEmptyRows(page.rows)})), migrated.albums).filter(page => !informationPages.some(information => information.path === page.path));
  const groupCentre: [number, number] | null = registration.group.latitude && registration.group.longitude ? [registration.group.latitude, registration.group.longitude] : null;
  const migratedPages = photosByYear(withIntroductionPhotos([...sourcePages, ...informationPages], migrated.albums), registration.pages || [], photoTemplates, groupCentre);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    const earlierImport = earlierImportFilters([...migratedPages, ...migrated.albums.map(album => album.pageContent)].filter(page => page?.path).map(page => page.path), migrated.albums.map(album => album.album.name));
    await connection.db.collection("pageContent").deleteMany(earlierImport.pages);
    await connection.db.collection(contentMetadata.collection.collectionName).deleteMany(earlierImport.albums);
    await Promise.all(migratedPages.map(page => connection.db.collection("pageContent").updateOne({path: page.path}, {$set: page}, {upsert: true})));
    await Promise.all(migrated.albums.map(async album => {
      await connection.db.collection(contentMetadata.collection.collectionName).updateOne({rootFolder: album.album.rootFolder, name: album.album.name}, {$set: album.album}, {upsert: true});
      const albumAlreadyOnAYearPage = migratedPages.some(page => (page.rows || []).some(row => row.carousel?.name === album.album.name));
      if (album.pageContent?.path && !albumAlreadyOnAYearPage) {
        await connection.db.collection("pageContent").updateOne({path: album.pageContent.path}, {$set: album.pageContent}, {upsert: true});
      }
    }));
    await importRegistrationCommittee(connection.db, migratedPages, registration, aiConfigFromEnvironment());
    const migratedPaths = new Set(migratedPages.map(page => page.path));
    const retainedBuiltInPaths = new Set(["#home-content", "admin#action-buttons", RegistrationNavbarPath.WALKS, PRIVACY_POLICY_PATH]);
    const samplePaths = createAllSamplePageContent({groupName: registration.group.name, groupShortName: toGroupShortName(registration.group.name)})
      .map(page => page.path).concat(COMMITTEE_ROOT_PATH);
    const navigationPaths = new Set(assembled.map(page => page.path));
    const unusedSamplePaths = samplePaths.filter(path => !migratedPaths.has(path) && !retainedBuiltInPaths.has(path) && !navigationPaths.has(path));
    const samplePagesForNavigation = createAllSamplePageContent({groupName: registration.group.name, groupShortName: toGroupShortName(registration.group.name)})
      .filter(page => navigationPaths.has(page.path) && !migratedPaths.has(page.path));
    await Promise.all(samplePagesForNavigation.map(page => connection.db.collection("pageContent")
      .updateOne({path: page.path}, {$setOnInsert: page}, {upsert: true})));
    if (unusedSamplePaths.length > 0) {
      await connection.db.collection("pageContent").deleteMany({path: {$in: unusedSamplePaths}});
      const linkingPages = await connection.db.collection<PageContent>("pageContent")
        .find({"rows.columns.href": {$in: unusedSamplePaths.flatMap(path => [path, `/${path}`])}}).toArray();
      await Promise.all(linkingPages.map(page => connection.db.collection("pageContent")
        .updateOne({_id: page._id}, {$set: {rows: withoutButtonsTo(page.rows, unusedSamplePaths)}})));
    }
    await withSourceContactDetails(connection, registration, importProgress);
    const availablePaths = new Set((await connection.db.collection<PageContent>("pageContent").find({"rows.0": {$exists: true}}, {projection: {path: 1}}).toArray()).map(page => page.path));
    await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {
      "value.header.navigationButtons": registrationHeaderButtons(registration.website),
      "value.group.pages": navigationPages(registration, availablePaths)
    }});
    const importedHome = migratedPages.find(page => page.path === "home" || page.path === "index");
    if (importedHome?.rows?.length) {
      const keyAreas = registrationKeyAreas(assembled, migratedPages, migrated.albums, availablePaths);
      await connection.db.collection("pageContent").updateOne({path: "#home-content"}, {$set: {rows: homeContentRows(importedHome, keyAreas)}}, {upsert: true});
    } else {
      const homeVisualColumns = visualColumnsFromPages(migratedPages);
      if (homeVisualColumns.length > 0) {
        await connection.db.collection<any>("pageContent").updateOne({path: "#home-content", "rows.migrationPlaceholder": {$ne: true}}, {
          $push: {rows: {$each: [landingVisualRow(homeVisualColumns)], $position: 0}}
        } as any);
      }
    }
  } finally {
    await connection.client.close();
  }
  await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {importedAt: dateTimeNowAsValue()}});
}

async function importedDocumentPages(registration: StoredSiteRegistration, importProgress: (message: string) => void): Promise<PageContent[]> {
  const documents = (registration.pages || []).filter(page => page.selected && isDocumentUrl(page.url));
  return (await Promise.all(documents.map(async page => {
    try {
      importProgress(`Reading ${page.title} from the document linked on the current website`);
      const markdown = await documentMarkdown(page.url);
      return markdown.trim()
        ? [{path: page.path, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: markdown.trim(), accessLevel: AccessLevel.PUBLIC}]}]} as PageContent]
        : [];
    } catch (error) {
      importProgress(`Skipped ${page.title}: its linked document could not be read (${error instanceof Error ? error.message : error})`);
      return [];
    }
  }))).flat();
}

async function withSourceContactDetails(connection: EnvironmentMongoConnection, registration: StoredSiteRegistration, importProgress: (message: string) => void): Promise<void> {
  const phone = registration.flavour === RegistrationSiteFlavour.RAMBLERS_HOSTED
    ? await fetchPublicSiteHtml(registration.website).then(ramblersHostedContactPhone).catch(() => "")
    : "";
  const contactPage = phone ? await connection.db.collection<PageContent>("pageContent").findOne({path: RegistrationNavbarPath.CONTACT_US}) : null;
  const firstColumn = contactPage?.rows?.[0]?.columns?.[0];
  if (firstColumn?.contentText && !firstColumn.contentText.includes(phone)) {
    importProgress(`Added the phone number published on the group's Ramblers page to Contact Us`);
    const rows = contactPage.rows.map((row, index) => index === 0
      ? {...row, columns: row.columns.map((column, columnIndex) => columnIndex === 0
        ? {...column, contentText: `${column.contentText}\n\nYou can also call us on ${phone}.`}
        : column)}
      : row);
    await connection.db.collection("pageContent").updateOne({path: RegistrationNavbarPath.CONTACT_US}, {$set: {rows}});
  }
}

function cleanMigratedText(text: string): string {
  return collapseExcessBlankLines(applyTextExclusions(text || "", {})).replace(/^\s*\[\s*$/gm, "").trim();
}

function cleanPageRows(rows: PageContentRow[], path: string): PageContentRow[] {
  return (rows || []).map(row => ({
    ...row,
    columns: (row.columns || []).map(column => ({
      ...column,
      contentText: column.contentText ? withContactUsLinks(cleanMigratedText(column.contentText), path) : column.contentText,
      rows: column.rows ? cleanPageRows(column.rows, path) : column.rows
    }))
  }));
}

const CHARACTERS_PER_TOKEN = 4;

async function tidyPageRows(rows: PageContentRow[]): Promise<PageContentRow[]> {
  const ai = aiConfigFromEnvironment();
  return Promise.all((rows || []).map(async row => ({
    ...row,
    columns: await Promise.all((row.columns || []).map(async column => ({
      ...column,
      contentText: column.contentText ? await tidiedText(ai, column.contentText, TidyTextKind.PAGE, (systemPrompt, text) => generate(ai, systemPrompt, text, Math.max(MAX_GENERATED_TOKENS, Math.ceil(text.length / CHARACTERS_PER_TOKEN) * 2))) : column.contentText,
      rows: column.rows ? await tidyPageRows(column.rows) : column.rows
    })))
  })));
}

function navigationPages(registration: StoredSiteRegistration, availablePaths: Set<string>) {
  const roots = registrationNavigationPages(registration).filter(page => !page.parentPath && page.selected);
  return roots.filter(page => isRegistrationFeaturePath(page.path) || page.path === RegistrationNavbarPath.HOME || availablePaths.has(page.path))
    .slice(0, 8).map(page => ({
    title: page.title,
    href: page.path === "home" ? "" : page.path,
    accessLevel: page.path === RegistrationNavbarPath.ADMIN ? AccessLevel.COMMITTEE : AccessLevel.PUBLIC
  }));
}

function registrationNavigationPages(registration: StoredSiteRegistration): RegistrationPage[] {
  const hasWalks = registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.WALKS);
  const hasSocialEvents = registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.EVENTS);
  return assembleRegistrationPages(registration.pages || [], hasWalks, hasSocialEvents);
}

function withChildNavigation(page: PageContent): PageContent {
  if (page.rows?.some(row => row.type === PageContentType.ALBUM_INDEX)) {
    return page;
  } else {
    const indexRow: PageContentRow = {
      type: PageContentType.ALBUM_INDEX, maxColumns: 4, minColumns: 2, showSwiper: false, columns: [],
      albumIndex: {
        contentPaths: [{contentPath: page.path, stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1}],
        excludePaths: [], columnOverrides: [], contentTypes: [IndexContentType.PAGES, IndexContentType.INDEX_PAGES],
        renderModes: [IndexRenderMode.ACTION_BUTTONS], indexMarkdown: "", autoTitle: false,
        showInParentIndex: true, minCols: 2, maxCols: 4
      }
    };
    return {...page, rows: [...(page.rows || []), indexRow]};
  }
}

function withLandingVisual(page: PageContent): PageContent {
  const rows = page.rows || [];
  const openingRow = rows[0];
  const hasOpeningVisual = openingRow?.columns?.some(column => column.imageSource || column.rows?.length);
  const imageRowIndex = rows.findIndex(row => (row.columns || []).length > 0 && (row.columns || []).every(column => column.imageSource && !column.contentText));
  if (hasOpeningVisual) {
    return {...page, rows: [landingImageRow(openingRow), ...rows.slice(1)]};
  } else if (imageRowIndex > -1) {
    return withRowsUnderHeading({...page, rows: rows.filter((row, index) => index !== imageRowIndex)}, [landingImageRow(rows[imageRowIndex])]);
  } else {
    const visualColumns = visualColumnsFromPages([page]);
    return visualColumns.length === 0 ? page : withRowsUnderHeading(page, [landingVisualRow(visualColumns)]);
  }
}

function landingVisualRow(columns: PageContentColumn[]): PageContentRow {
  return landingImageRow({type: PageContentType.TEXT, maxColumns: 1, showSwiper: true, migrationPlaceholder: true, columns});
}

function landingImageRow(row: PageContentRow): PageContentRow {
  return {...row, columns: (row.columns || []).map(column => column.imageSource ? {
    ...column,
    imageHeight: Math.min(column.imageHeight || LANDING_IMAGE_MAX_HEIGHT, LANDING_IMAGE_MAX_HEIGHT),
    imageFit: column.imageFit || ImageFit.COVER
  } : column)};
}

function visualColumnsFromPages(pages: PageContent[]): PageContentColumn[] {
  const columns = pages.flatMap(page => visualColumnsFromRows(page.rows || []));
  return [...new Map(columns.map(column => [column.imageSource, column])).values()].slice(0, 2);
}

function visualColumnsFromRows(rows: PageContentRow[]): PageContentColumn[] {
  return rows.flatMap(row => row.columns || []).flatMap(column => [
    ...(column.imageSource ? [{columns: 12, imageSource: column.imageSource, alt: column.alt || "", accessLevel: AccessLevel.PUBLIC}] : []),
    ...visualColumnsFromRows(column.rows || [])
  ]);
}

async function registrationWalks(envConfigData: EnvironmentConfig): Promise<RegistrationWalkCandidate[]> {
  const connection = await connectToEnvironmentMongo(envConfigData);
  try {
    const walks = await connection.db.collection<ExtendedGroupEvent>(extendedGroupEvent.collection.collectionName)
      .find({"groupEvent.start_date_time": {$exists: true}}, {projection: {"groupEvent.id": 1, "groupEvent.start_date_time": 1, "groupEvent.title": 1, "groupEvent.start_location.description": 1}})
      .toArray();
    return walks.filter(walk => walk.groupEvent?.id).map(walk => ({
      id: walk.groupEvent.id,
      startDateTime: walk.groupEvent.start_date_time,
      title: walk.groupEvent.title || "",
      location: walk.groupEvent.start_location?.description || ""
    }));
  } finally {
    await connection.client.close();
  }
}

async function notifyReviewer(registration: StoredSiteRegistration): Promise<void> {
  const claimed = await registrations().findOneAndUpdate(
    {id: registration.id, reviewNotifiedAt: null},
    {$set: {reviewNotifiedAt: dateTimeNowAsValue()}},
    {returnDocument: "after"}
  );
  if (claimed) {
    const settings = await registrationSettings();
    await sendRegistrationEmail(settings, RegistrationEmailType.REVIEW, settings.reviewer.email, {
      groupName: registration.group.name,
      actionUrl: `${settings.publicUrl}/admin/platform/environment-management/registrations`, siteUrl: registration.siteUrl
    });
  }
}

export async function approveRegistration(id: string, approvedBy: string): Promise<void> {
  const registration = await registrations().findOneAndUpdate({id, state: RegistrationState.REVIEW}, {$set: {state: RegistrationState.APPROVING, reviewedAt: dateTimeNowAsValue() }}, {returnDocument: "after"});
  if (!registration) {
    throw new Error("Only a site ready for review can be approved.");
  } else {
    await recordRegistrationHistory(id, RegistrationHistoryAction.APPROVED, approvedBy);
  }
}

async function inviteGroup(registration: StoredSiteRegistration): Promise<void> {
  const settings = await registrationSettings();
  const context = await loadEnvironmentContext(registration.environmentName);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    const created = createAdminMember({adminUser: {firstName: registration.group.name, lastName: "Admin", email: registration.email}, groupCode: registration.group.group_code});
    created.member.passwordResetId = registrationToken();
    await connection.db.collection("members").updateOne({email: registration.email}, {$set: created.member}, {upsert: true});
    const member = await connection.db.collection("members").findOne({email: registration.email});
    await sendRegistrationEmail(settings, RegistrationEmailType.INVITATION, registration.email, {
      groupName: registration.group.name, siteUrl: registration.siteUrl,
      actionUrl: `${registration.siteUrl}/${ADMIN_SET_PASSWORD_PATH}/${member.passwordResetId}`
    });
    await setEnvironmentEstateDeploy(registration.environmentName, true);
    await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {state: RegistrationState.COMPLETE, invitedAt: dateTimeNowAsValue(), error: null}});
    await recordRegistrationHistory(registration.id, RegistrationHistoryAction.INVITED, REGISTRATION_SYSTEM_ACTOR);
  } finally {
    await connection.client.close();
  }
}

export async function runRegistrationJobs(): Promise<void> {
  if (running.active && running.registrationId && !await leasedByThisWorker(running.registrationId)) {
    debugLog("releasing the job runner from stopped registration %s", running.registrationId);
    running.active = false;
    running.registrationId = null;
  }
  if (!running.active && (await registrationSettings()).enabled) {
    running.active = true;
    const claimed = {id: null as string | null};
    try {
      const now = dateTimeNowAsValue();
      await registrations().updateMany({state: {$in: [RegistrationState.PROVISIONING, RegistrationState.IMPORTING]}, leaseUntil: {$lt: now}}, {$set: {state: RegistrationState.FAILED, error: "Background processing was interrupted. Review progress and retry.", leaseOwner: null}});
      const registration = await registrations().findOneAndUpdate({state: {$in: [RegistrationState.QUEUED, RegistrationState.APPROVING]}, leaseUntil: {$lt: now}}, {$set: {leaseOwner: workerId, leaseUntil: now + LEASE_MS}}, {returnDocument: "after"});
      if (registration) {
        running.registrationId = registration.id;
        claimed.id = registration.id;
        const heartbeat = leaseHeartbeat(registration.id);
        const stage = {name: RegistrationJobStage.STARTING};
        try {
          if (registration.state === RegistrationState.APPROVING) {
            stage.name = RegistrationJobStage.INVITING;
            await inviteGroup(registration);
          } else {
            if (!registration.provisionedAt) {
              stage.name = RegistrationJobStage.PROVISIONING;
              await assertStillLeased(registration.id);
              await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {state: RegistrationState.PROVISIONING}});
              await provisionRegistration(registration);
              await stageFinished(registration, RegistrationStageKey.SITE_CREATED, RegistrationHistoryAction.PROVISIONED);
            }
            stage.name = RegistrationJobStage.OS_MAPS;
            await assertStillLeased(registration.id);
            await ensureOsMapsApiKey(registration.environmentName, message => pushProgress(registration, "OS Maps", SetupStepStatus.Completed, message), message => pushProgress(registration, "OS Maps", SetupStepStatus.Running, message));
            if (!registration.walksLoadedAt) {
              stage.name = RegistrationJobStage.WALKS;
              await assertStillLeased(registration.id);
              await loadWalksFromWalksManager(registration);
              await stageFinished(registration, RegistrationStageKey.WALKS_LOADED, RegistrationHistoryAction.WALKS_LOADED);
            }
            if (registration.plan === RegistrationPlan.FULL && !registration.importedAt) {
              stage.name = RegistrationJobStage.IMPORTING;
              await assertStillLeased(registration.id);
              await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {state: RegistrationState.IMPORTING}});
              await importRegistration(registration);
              await stageFinished(registration, RegistrationStageKey.PAGES_IMPORTED, RegistrationHistoryAction.IMPORTED);
            }
            stage.name = RegistrationJobStage.REVIEWER;
            await assertStillLeased(registration.id);
            const ready = await registrations().updateOne({id: registration.id, leaseOwner: workerId, state: {$in: [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING]}}, {$set: {state: RegistrationState.REVIEW, error: null}});
            if (ready.matchedCount) {
              await notifyReviewer(registration);
              await stageFinished(registration, RegistrationStageKey.READY_FOR_REVIEW, RegistrationHistoryAction.READY_FOR_REVIEW);
            }
          }
        } catch (error) {
          debugLog("Registration %s failed while %s: %s", registration.id, stage.name, error.message);
          const failed = await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {state: RegistrationState.FAILED, error: registrationFailureMessage(stage.name, sanitiseRegistrationMessage(error.message))}});
          if (failed.matchedCount) {
            await recordRegistrationHistory(registration.id, RegistrationHistoryAction.FAILED, REGISTRATION_SYSTEM_ACTOR);
          }
        } finally {
          clearInterval(heartbeat);
          await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {leaseUntil: 0, leaseOwner: null, updatedAt: dateTimeNowAsValue()}});
        }
      }
    } finally {
      if (!claimed.id || running.registrationId === claimed.id) {
        running.active = false;
        running.registrationId = null;
      }
    }
  }
}

export async function scheduleRegistrationJobs(): Promise<void> {
  if (process.env.PLATFORM_ADMIN_ENABLED === "true") {
    await ensureRegistrationIndexes();
    await registerScheduledTask({id: ScheduledTaskId.SITE_REGISTRATION, name: "Site registrations", description: "Build and prepare group review sites", cronExpression: "* * * * *", enabled: true, run: runRegistrationJobs});
  }
}
