import debug from "debug";
import { randomUUID } from "crypto";
import { RegistrationEmailType, RegistrationNavbarPath, RegistrationPlan, RegistrationState, RegistrationStep, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { createEmptySetupRequest, environmentNameForGroup, prefixedEnvironmentResourceName, SetupStepStatus } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { ADMIN_SET_PASSWORD_PATH, EventPopulation } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { registrations, registrationSettings, ensureRegistrationIndexes } from "./registration-store";
import { assertRegistrationEditable } from "./registration-policy";
import { registrationForToken } from "./registration-service";
import { registrationMigrationConfig } from "./registration-content";
import { createEnvironment } from "../environment-setup/environment-setup-service";
import { environmentDetails } from "../environment-setup/environment-details";
import { resumeEnvironment } from "../cli/commands/environment";
import { connectToEnvironmentMongo, loadEnvironmentContext } from "../environment-setup/environment-context";
import { findEnvironmentFromDatabase, setEnvironmentEstateDeploy } from "../environments/environments-config";
import { createAdminMember } from "../environment-setup/templates/sample-data/admin-member-template";
import { systemConfig } from "../config/system-config";
import { migrateStaticSite } from "../migration/migrate-static-site-engine";
import { setProgressSender } from "../migration/migration-progress";
import { dateTimeNowAsValue } from "../shared/dates";
import { sendRegistrationEmail } from "../brevo/transactional-mail/send-site-registration-email";
import { registerScheduledTask } from "../cron/scheduled-task-registry";
import { envConfig } from "../env-config/env-config";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { connect as connectMongoose, disconnect as disconnectMongoose } from "../mongo/mongoose-client";
import { syncWalksManagerData } from "../walks/walks-manager-sync";
import { walksManagerSyncEnabled } from "../../../projects/ngx-ramblers/src/app/functions/walks/walks-manager-sync-config";
import { buildMongoUri } from "../shared/mongodb-uri";
import { registrationToken } from "./registration-policy";
import { fetchRamblersGroupsFromApi } from "../ramblers/list-groups";
import * as registrationLogos from "./registration-logos";
import { ensureOsMapsApiKey, osMapsConfigForEnvironment } from "../os-maps/provision-os-maps-key";
import { applyTextExclusions, collapseExcessBlankLines } from "../migration/text-exclusions";
import { aiConfigFromEnvironment } from "../ai/ai-config";
import { generate } from "../ai/ai-generation";
import { tidiedText } from "../ai/description-tidy";
import { TidyTextKind } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { assembleRegistrationPages } from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import {
  IndexContentType, IndexRenderMode, PageContent, PageContentColumn, PageContentRow, PageContentType, StringMatch
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const debugLog = debug(envConfig.logNamespace("site-registration:jobs"));
const workerId = randomUUID();
const running = {active: false};

export async function submitRegistration(token: string): Promise<void> {
  const registration = await registrationForToken(token);
  assertRegistrationEditable(registration);
  const settings = await registrationSettings();
  const environmentName = environmentNameForGroup(registration.group.name) || registration.group.group_code.toLowerCase();
  if (!settings.enabled || !settings.sourceEnvironmentName || !settings.reviewer.email || !settings.senderEmail) {
    throw new Error("Registration provisioning is not configured yet. Your answers have been saved.");
  } else if (await findEnvironmentFromDatabase(environmentName)) {
    throw new Error("An environment already exists for this group. Please contact the platform administrator.");
  } else {
    const migrationConfig = registration.plan === RegistrationPlan.FULL ? registrationMigrationConfig(registration) : null;
    await registrations().updateOne({id: registration.id, state: RegistrationState.DRAFT}, {$set: {
      state: RegistrationState.QUEUED, currentStep: RegistrationStep.PROGRESS, migrationConfig,
      environmentName, updatedAt: dateTimeNowAsValue()
    }});
  }
}

async function provisionRegistration(registration: StoredSiteRegistration): Promise<void> {
  const settings = await registrationSettings();
  const details = await environmentDetails(settings.sourceEnvironmentName);
  const currentSystem = await systemConfig();
  const defaults = createEmptySetupRequest();
  const name = registration.environmentName;
  const area = (await fetchRamblersGroupsFromApi([registration.group.area_code])).find(candidate => candidate.scope === "A");
  const request = {
    ...defaults,
    ramblersInfo: {areaCode: registration.group.area_code, areaName: area?.name || registration.group.area_code,
      groupCode: registration.group.group_code, groupName: registration.group.name, groupData: registration.group, areaData: area},
    environmentBasics: {...defaults.environmentBasics, ...details.environmentBasics, environmentName: name,
      appName: prefixedEnvironmentResourceName(name, 30)},
    serviceConfigs: {...defaults.serviceConfigs, ...details.serviceConfigs,
      aws: {...details.serviceConfigs.aws, bucket: prefixedEnvironmentResourceName(name, 63)},
      mongodb: {...details.serviceConfigs.mongodb, database: prefixedEnvironmentResourceName(name, 38)},
      ramblers: {apiKey: currentSystem.national.walksManager.apiKey},
      osMaps: await osMapsConfigForEnvironment(name)},
    adminUser: settings.reviewer,
    options: {...defaults.options, setupSubdomain: true, ngxLite: registration.plan === RegistrationPlan.LITE, estateDeploy: false}
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
      $set: {updatedAt: dateTimeNowAsValue(), leaseUntil: dateTimeNowAsValue() + 3600000}
    };
    const write = platform
      ? platform.db().collection<StoredSiteRegistration>("siteRegistrations").updateOne({id: registration.id, leaseOwner: workerId}, update)
      : registrations().updateOne({id: registration.id, leaseOwner: workerId}, update);
    progressWrites.push(write);
    return write;
  };
  try {
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
    if (mongoUri.startsWith("mongodb")) {
      await connectMongoose();
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

async function loadWalksFromWalksManager(registration: StoredSiteRegistration): Promise<void> {
  const context = await loadEnvironmentContext(registration.environmentName);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  const wantsEvents = (registration.proposedNavigation || []).some(item => item.path === RegistrationNavbarPath.EVENTS);
  let config;
  try {
    if (wantsEvents) {
      await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {"value.group.socialEventPopulation": EventPopulation.WALKS_MANAGER}});
    }
    const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
    config = system?.value;
  } finally {
    await connection.client.close();
  }
  if (!walksManagerSyncEnabled(config) || !context.envConfigData?.mongo?.cluster) {
    await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
      $push: {progress: {$each: [{step: "Walks Manager", status: SetupStepStatus.Completed, message: "Skipped - this site does not load walks from Walks Manager", timestamp: dateTimeNowAsValue()}], $slice: -100}},
      $set: {walksLoadedAt: dateTimeNowAsValue(), updatedAt: dateTimeNowAsValue()}
    });
  } else {
    const mongo = context.envConfigData.mongo;
    const uri = buildMongoUri({cluster: mongo.cluster, username: mongo.username || "", password: mongo.password || "", database: mongo.db});
    await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
      $push: {progress: {$each: [{step: "Walks Manager", status: SetupStepStatus.Running, message: "Loading the full Walks Manager programme", timestamp: dateTimeNowAsValue()}], $slice: -100}}
    });
    await disconnectMongoose();
    try {
      await mongoose.connect(uri);
      const result = await syncWalksManagerData(config, {fullSync: true}, null);
      if (result.errors.length) {
        throw new Error(`Walks Manager load finished with errors: ${result.errors.join("; ")}`);
      } else {
        await disconnectMongoose();
        await connectMongoose();
        await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
          $push: {progress: {$each: [{step: "Walks Manager", status: SetupStepStatus.Completed, message: `Loaded ${result.totalProcessed} items from Walks Manager (${result.added} new)`, timestamp: dateTimeNowAsValue()}], $slice: -100}},
          $set: {walksLoadedAt: dateTimeNowAsValue(), updatedAt: dateTimeNowAsValue()}
        });
      }
    } catch (error) {
      await disconnectMongoose();
      await connectMongoose();
      throw error;
    }
  }
}

async function importRegistration(registration: StoredSiteRegistration): Promise<void> {
  const migration = registration.migrationConfig;
  const context = await loadEnvironmentContext(registration.environmentName);
  const migrationConnection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    await migrationConnection.db.collection("config").updateOne({key: ConfigKey.MIGRATION}, {$set: {value: {sites: [{...migration, persistData: true}]}}}, {upsert: true});
  } finally {
    await migrationConnection.client.close();
  }
  setProgressSender(data => {
    const message = data.message || "";
    if (!/resource failed|resource load error|net::ERR/i.test(message)) {
      const status = /✅|migrated/i.test(message) ? SetupStepStatus.Completed
        : /error|failed|❌/i.test(message) ? SetupStepStatus.Failed
        : /skipped/i.test(message) ? SetupStepStatus.Completed
        : SetupStepStatus.Running;
      registrations().updateOne({id: registration.id, leaseOwner: workerId}, {
        $push: {progress: {$each: [{step: "Import", status, message, timestamp: dateTimeNowAsValue()}], $slice: -400}},
        $set: {updatedAt: dateTimeNowAsValue(), leaseUntil: dateTimeNowAsValue() + 3600000}
      }).catch(error => debugLog("import progress write failed: %s", error.message));
    }
  });
  let result;
  try {
    result = await migrateStaticSite({
      ...migration,
      persistData: true,
      requireSourceFidelity: false,
      uploadTos3: true,
      uploadBucket: context.envConfigData.aws?.bucket
    });
  } finally {
    setProgressSender(null);
  }
  const imported = result.pageContents.filter(page => page.path && page.rows?.length);
  if (!imported.length) {
    throw new Error("No pages could be imported from the current website.");
  }
  const assembled = assembleRegistrationPages(registration.pages || [], true, true);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    for (const page of result.pageContents) {
      const assembledPage = assembled.find(item => item.path === page.path || (item.path.split("/").pop() || item.path) === page.path);
      const targetPath = assembledPage?.path || page.path;
      const pageWithNavigation = assembled.some(sourcePage => sourcePage.parentPath === targetPath) ? withChildNavigation({...page, path: targetPath}) : {...page, path: targetPath};
      const landingPage = assembled.some(item => !item.parentPath && item.path === targetPath) ? withLandingVisual(pageWithNavigation) : pageWithNavigation;
      await connection.db.collection("pageContent").updateOne({path: landingPage.path}, {$set: {path: landingPage.path, rows: await tidyPageRows(cleanPageRows(landingPage.rows))}}, {upsert: true});
    }
    if (assembled.some(page => page.parentPath === RegistrationNavbarPath.INFORMATION)) {
      const information = withChildNavigation({
        path: RegistrationNavbarPath.INFORMATION,
        rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "## Information"}]}]
      });
      await connection.db.collection("pageContent").updateOne({path: information.path}, {$set: {path: information.path, rows: information.rows}}, {upsert: true});
    }
    for (const album of result.albums) {
      await connection.db.collection("contentMetadata").updateOne({rootFolder: album.album.rootFolder, name: album.album.name}, {$set: album.album}, {upsert: true});
      if (album.pageContent?.path) {
        await connection.db.collection("pageContent").updateOne({path: album.pageContent.path}, {$set: album.pageContent}, {upsert: true});
      }
    }
    await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {
      "value.header.navigationButtons": [{title: "National Ramblers", href: "https://ramblers.org.uk"}],
      "value.group.pages": navigationPages(registration)
    }});
    const importedHome = result.pageContents.find(page => page.path === "home" || page.path === "index");
    const albumRows = result.albums.map(album => album.pageContent?.rows?.[0]).filter(Boolean);
    if (importedHome?.rows?.length || albumRows.length) {
      await connection.db.collection("pageContent").updateOne({path: "#home-content"}, {$set: {rows: [...albumRows, ...await tidyPageRows(cleanPageRows(importedHome?.rows || []))]}}, {upsert: true});
    } else {
      const homeVisualColumns = visualColumnsFromPages(result.pageContents);
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

function cleanMigratedText(text: string): string {
  return collapseExcessBlankLines(applyTextExclusions(text || "", {})).replace(/^\s*\[\s*$/gm, "").trim();
}

function cleanPageRows(rows: PageContentRow[]): PageContentRow[] {
  return (rows || []).map(row => ({
    ...row,
    columns: (row.columns || []).map(column => ({
      ...column,
      contentText: column.contentText ? cleanMigratedText(column.contentText) : column.contentText,
      rows: column.rows ? cleanPageRows(column.rows) : column.rows
    }))
  }));
}

async function tidyPageRows(rows: PageContentRow[]): Promise<PageContentRow[]> {
  const ai = aiConfigFromEnvironment();
  return Promise.all((rows || []).map(async row => ({
    ...row,
    columns: await Promise.all((row.columns || []).map(async column => ({
      ...column,
      contentText: column.contentText ? await tidiedText(ai, column.contentText, TidyTextKind.PAGE, (systemPrompt, text) => generate(ai, systemPrompt, text)) : column.contentText,
      rows: column.rows ? await tidyPageRows(column.rows) : column.rows
    })))
  })));
}

function navigationPages(registration: StoredSiteRegistration) {
  const roots = assembleRegistrationPages(registration.pages || [], true, true).filter(page => !page.parentPath && page.selected);
  return roots.slice(0, 8).map(page => ({
    title: page.title,
    href: page.path === "home" ? "" : page.path,
    accessLevel: page.path === RegistrationNavbarPath.ADMIN ? AccessLevel.COMMITTEE : AccessLevel.PUBLIC
  }));
}

function withChildNavigation(page: PageContent): PageContent {
  if (page.rows?.some(row => row.type === PageContentType.ALBUM_INDEX)) {
    return page;
  } else {
    const depth = page.path.split("/").length;
    const indexRow: PageContentRow = {
      type: PageContentType.ALBUM_INDEX, maxColumns: 4, minColumns: 2, showSwiper: true, columns: [],
      albumIndex: {
        contentPaths: [{contentPath: `${page.path}/`, stringMatch: StringMatch.STARTS_WITH, maxPathSegments: depth + 1}],
        excludePaths: [], columnOverrides: [], contentTypes: [IndexContentType.PAGES, IndexContentType.INDEX_PAGES],
        renderModes: [IndexRenderMode.ACTION_BUTTONS], indexMarkdown: "", autoTitle: false,
        showInParentIndex: true, minCols: 2, maxCols: 4
      }
    };
    return {...page, rows: [...(page.rows || []), indexRow]};
  }
}

function withLandingVisual(page: PageContent): PageContent {
  const openingRow = page.rows?.[0];
  const hasOpeningVisual = openingRow?.showSwiper && openingRow.columns.some(column => column.imageSource || column.rows?.length);
  const visualColumns = visualColumnsFromPages([page]);
  return hasOpeningVisual || visualColumns.length === 0 ? page : {...page, rows: [landingVisualRow(visualColumns), ...(page.rows || [])]};
}

function landingVisualRow(columns: PageContentColumn[]): PageContentRow {
  return {type: PageContentType.TEXT, maxColumns: 1, showSwiper: true, migrationPlaceholder: true, columns};
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

export async function approveRegistration(id: string): Promise<void> {
  const registration = await registrations().findOneAndUpdate({id, state: RegistrationState.REVIEW}, {$set: {state: RegistrationState.APPROVING, reviewedAt: dateTimeNowAsValue() }}, {returnDocument: "after"});
  if (!registration) {
    throw new Error("Only a site ready for review can be approved.");
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
  } finally {
    await connection.client.close();
  }
}

export async function runRegistrationJobs(): Promise<void> {
  if (!running.active && (await registrationSettings()).enabled) {
    running.active = true;
    try {
      const now = dateTimeNowAsValue();
      await registrations().updateMany({state: {$in: [RegistrationState.PROVISIONING, RegistrationState.IMPORTING]}, leaseUntil: {$lt: now}}, {$set: {state: RegistrationState.FAILED, error: "Background processing was interrupted. Review progress and retry.", leaseOwner: null}});
      const registration = await registrations().findOneAndUpdate({state: {$in: [RegistrationState.QUEUED, RegistrationState.APPROVING]}, leaseUntil: {$lt: now}}, {$set: {leaseOwner: workerId, leaseUntil: now + 3600000}}, {returnDocument: "after"});
      if (registration) {
        try {
          if (registration.state === RegistrationState.APPROVING) {
            await inviteGroup(registration);
          } else {
            if (!registration.provisionedAt) {
              await registrations().updateOne({id: registration.id}, {$set: {state: RegistrationState.PROVISIONING}});
              await provisionRegistration(registration);
            }
            if (registration.plan === RegistrationPlan.FULL && !registration.importedAt) {
              await registrations().updateOne({id: registration.id}, {$set: {state: RegistrationState.IMPORTING}});
              await importRegistration(registration);
            }
            await ensureOsMapsApiKey(registration.environmentName);
            if (!registration.walksLoadedAt) {
              await loadWalksFromWalksManager(registration);
            }
            await registrations().updateOne({id: registration.id}, {$set: {state: RegistrationState.REVIEW, error: null}});
            await notifyReviewer(registration);
          }
        } catch (error) {
          debugLog("Registration %s failed: %s", registration.id, error.message);
          await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {state: RegistrationState.FAILED, error: error.message}});
        } finally {
          await registrations().updateOne({id: registration.id, leaseOwner: workerId}, {$set: {leaseUntil: 0, leaseOwner: null, updatedAt: dateTimeNowAsValue()}});
        }
      }
    } finally {
      running.active = false;
    }
  }
}

export async function scheduleRegistrationJobs(): Promise<void> {
  if (process.env.PLATFORM_ADMIN_ENABLED === "true") {
    await ensureRegistrationIndexes();
    await registerScheduledTask({id: "site-registration", name: "Site registrations", description: "Build and prepare group review sites", cronExpression: "* * * * *", enabled: true, run: runRegistrationJobs});
  }
}
