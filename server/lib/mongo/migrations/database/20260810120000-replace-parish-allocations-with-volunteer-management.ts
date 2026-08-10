import { Db, MongoClient } from "mongodb";
import { dateTimeNowAsValue } from "../../../shared/dates";
import createMigrationLogger from "../migrations-logger";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerImportCoverageStatus,
  VolunteerLetterType,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../../../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { AdminMembersPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { MEMBERS_MENU_ITEMS } from "../shared/admin-menu-items";
import { ensureActionButton, removeActionButtonByHref } from "../shared/page-content-actions";
import { VOLUNTEER_NOTIFICATION_SUBJECT_TEXT } from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { volunteerLetterSeeds } from "../../../../../projects/ngx-ramblers/src/app/functions/volunteer-letters";
import { PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { SystemConfig } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { UK_MAP_CENTER, UK_MAP_ZOOM } from "../../../../../projects/ngx-ramblers/src/app/models/map.model";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("replace-parish-allocations-with-volunteer-management");

const membersPath = "admin/members#action-buttons";
const volunteerManagementMenuItem = MEMBERS_MENU_ITEMS.find(item => item.href === AdminMembersPath.VOLUNTEERS);
const myVolunteerInformationMenuItem = MEMBERS_MENU_ITEMS.find(item => item.href === AdminMembersPath.MY_VOLUNTEER_INFORMATION);

const BREVO_CONFIG_KEY = "brevo";
const COMMITTEE_CONFIG_KEY = "committee";
const CONFIG_COLLECTION = "config";
const NOTIFICATION_CONFIG_COLLECTION = "notificationConfigs";
const APP_SHORT_NAME_PREFIX_PARAMETER = "systemMergeFields.APP_SHORTNAME";
const FULL_NAME_SUFFIX_PARAMETER = "memberMergeFields.FULL_NAME";
const DEFAULT_TEMPLATE_NAME = "fully-automated-text-body";
const VOLUNTEER_MAP_CONTENT_PATH = "admin/members/volunteers#map";
const MY_VOLUNTEER_INFORMATION_CONTENT_PATH = "admin/members/my-volunteer-information#introduction";
const MY_VOLUNTEER_INFORMATION_DEFAULT_TEXT = "## My volunteer information\n\nThe rights-of-way parishes you cover, the officers you work alongside, and the council contacts for each parish. This page is read only and shows only your own assignments.";

async function migrateParishAllocations(db: Db) {
  await db.collection("members").updateMany({memberAdmin: true, volunteerAdmin: {$ne: true}}, {$set: {volunteerAdmin: true}});
  const legacyCollection = db.collection("parishAllocations");
  const legacyAllocations = await legacyCollection.find({}).toArray();
  const now = dateTimeNowAsValue();
  const parishOperations = legacyAllocations.map(allocation => ({
    updateOne: {
      filter: {groupCode: allocation.groupCode, parishCode: allocation.parishCode},
      update: {$setOnInsert: {
        groupCode: allocation.groupCode,
        parishCode: allocation.parishCode,
        parishName: allocation.parishName,
        eligibility: VolunteerParishEligibility.ACTIVE,
        notes: allocation.notes,
        updatedAt: allocation.updatedAt ?? now,
        updatedBy: allocation.updatedBy ?? "migration"
      }},
      upsert: true
    }
  }));
  const assignmentOperations = legacyAllocations
    .filter(allocation => allocation.status === VolunteerImportCoverageStatus.ALLOCATED)
    .map(allocation => {
      const supporterId = allocation.assigneeMemberId?.toString() || null;
      return {
        updateOne: {
          filter: {sourceReference: `parish-allocation:${allocation._id.toString()}`},
          update: {$setOnInsert: {
            groupCode: allocation.groupCode,
            parishCode: allocation.parishCode,
            supporterId,
            unresolvedName: supporterId ? null : allocation.assignee || "Existing allocated coverage",
            sourceReference: `parish-allocation:${allocation._id.toString()}`,
            identityStatus: supporterId ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
            roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
            coverage: VolunteerAssignmentCoverage.PERMANENT,
            status: VolunteerAssignmentStatus.ACTIVE,
            effectiveFrom: allocation.updatedAt ?? now,
            createdAt: allocation.updatedAt ?? now,
            createdBy: allocation.updatedBy ?? "migration",
            updatedAt: allocation.updatedAt ?? now,
            updatedBy: allocation.updatedBy ?? "migration"
          }},
          upsert: true
        }
      };
    });
  if (parishOperations.length > 0) {
    await db.collection("volunteerParishes").bulkWrite(parishOperations);
  }
  if (assignmentOperations.length > 0) {
    await db.collection("volunteerAssignments").bulkWrite(assignmentOperations);
  }
  if (legacyAllocations.length > 0) {
    await legacyCollection.drop();
  }
  debugLog("migrated %d parishes and %d assignments", parishOperations.length, assignmentOperations.length);
}

async function ensureMenuItem(db: Db) {
  if (volunteerManagementMenuItem) {
    await ensureActionButton(db, membersPath, volunteerManagementMenuItem, debugLog);
  } else {
    debugLog("Volunteer Management menu item is not configured");
  }
  if (myVolunteerInformationMenuItem) {
    await ensureActionButton(db, membersPath, myVolunteerInformationMenuItem, debugLog);
  } else {
    debugLog("My Volunteer Information menu item is not configured");
  }
}

async function seedMyVolunteerInformationContent(db: Db) {
  const pageContentCollection = db.collection(PAGE_CONTENT_COLLECTION);
  const existing = await pageContentCollection.findOne({path: MY_VOLUNTEER_INFORMATION_CONTENT_PATH});
  if (existing) {
    debugLog("My volunteer information content already exists at %s", MY_VOLUNTEER_INFORMATION_CONTENT_PATH);
  } else {
    await pageContentCollection.insertOne({
      path: MY_VOLUNTEER_INFORMATION_CONTENT_PATH,
      rows: [{
        maxColumns: 1,
        showSwiper: false,
        type: PageContentType.TEXT,
        columns: [{columns: 12, contentText: MY_VOLUNTEER_INFORMATION_DEFAULT_TEXT}]
      }]
    });
    debugLog("Created default my volunteer information content at %s", MY_VOLUNTEER_INFORMATION_CONTENT_PATH);
  }
}

function resolveVolunteerRole(committeeRoles: {type?: string; vacant?: boolean}[]): string {
  const preferred = ["footpaths", "rights-of-way", "secretary", "chairman"];
  const byType = preferred.map(type => committeeRoles.find(role => role.type === type)).find(Boolean);
  return byType?.type || committeeRoles.find(role => !role.vacant && role.type)?.type || "secretary";
}

async function seedVolunteerNotificationConfig(db: Db) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configCollection = db.collection(CONFIG_COLLECTION);

  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});
  const committeeRoles: {type?: string; vacant?: boolean}[] = committeeConfig?.value?.roles || [];
  const volunteerRole = resolveVolunteerRole(committeeRoles);

  const bannerReference = await notificationConfigs.findOne({bannerId: {$exists: true, $ne: null}});
  const bannerId = bannerReference?.bannerId ?? null;
  const appointment = volunteerLetterSeeds().find(seed => seed.letterType === VolunteerLetterType.APPOINTMENT);

  const existing = await notificationConfigs.findOne({"subject.text": VOLUNTEER_NOTIFICATION_SUBJECT_TEXT});
  let configId = existing?._id;
  if (!existing) {
    const inserted = await notificationConfigs.insertOne({
      subject: {
        prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
        text: VOLUNTEER_NOTIFICATION_SUBJECT_TEXT,
        suffixParameter: FULL_NAME_SUFFIX_PARAMETER
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: "recently-added",
      templateName: DEFAULT_TEMPLATE_NAME,
      senderRole: volunteerRole,
      replyToRole: volunteerRole,
      signOffRoles: [volunteerRole],
      body: appointment?.introMarkdown ?? "",
      bannerId
    });
    configId = inserted.insertedId;
    debugLog("Created Rights of Way Volunteer Correspondence notification config: %s", configId);
  } else {
    const repair: Record<string, unknown> = {};
    if (!existing.templateName) {
      repair.templateName = DEFAULT_TEMPLATE_NAME;
    }
    if (!existing.senderRole) {
      repair.senderRole = volunteerRole;
    }
    if (!existing.signOffRoles?.length) {
      repair.signOffRoles = [volunteerRole];
    }
    if (!existing.body) {
      repair.body = appointment?.introMarkdown ?? "";
    }
    if (Object.keys(repair).length > 0) {
      await notificationConfigs.updateOne({_id: existing._id}, {$set: repair});
      debugLog("Repaired Rights of Way Volunteer Correspondence notification config %s: %o", configId, repair);
    } else {
      debugLog("Rights of Way Volunteer Correspondence notification config already complete: %s", configId);
    }
  }

  const brevoConfig = await configCollection.findOne({key: BREVO_CONFIG_KEY});
  if (brevoConfig && !brevoConfig.value?.volunteerNotificationConfigId) {
    await configCollection.updateOne(
      {key: BREVO_CONFIG_KEY},
      {$set: {"value.volunteerNotificationConfigId": configId.toString()}}
    );
    debugLog("Wired volunteerNotificationConfigId %s into brevo config", configId);
  } else {
    debugLog("volunteerNotificationConfigId already wired into brevo config");
  }
}

async function seedVolunteerMapPageContent(db: Db) {
  const pageContentCollection = db.collection(PAGE_CONTENT_COLLECTION);
  const existing = await pageContentCollection.findOne({path: VOLUNTEER_MAP_CONTENT_PATH});
  if (existing) {
    debugLog("Volunteer map page content already exists at %s", VOLUNTEER_MAP_CONTENT_PATH);
    return;
  }
  const systemConfigDocument = await db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.SYSTEM});
  const systemConfig = systemConfigDocument?.value as SystemConfig | undefined;
  const groupCenter = systemConfig?.group?.center;
  const mapCenter = groupCenter?.length === 2 ? [groupCenter[0], groupCenter[1]] : [...UK_MAP_CENTER];
  const mapZoom = systemConfig?.group?.zoom || UK_MAP_ZOOM;
  await pageContentCollection.insertOne({
    path: VOLUNTEER_MAP_CONTENT_PATH,
    rows: [{
      maxColumns: 1,
      showSwiper: false,
      type: PageContentType.AREA_MAP,
      columns: [],
      areaMap: {
        region: systemConfig?.area?.shortName,
        showAreas: true,
        showGroupLabels: false,
        showParishes: true,
        opacityNormal: 0.08,
        mapHeight: 520,
        mapCenter,
        mapZoom
      }
    }]
  });
  debugLog("Created volunteer map page content at %s (center=%o zoom=%d)", VOLUNTEER_MAP_CONTENT_PATH, mapCenter, mapZoom);
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await migrateParishAllocations(db);
  await ensureMenuItem(db);
  await seedVolunteerNotificationConfig(db);
  await seedVolunteerMapPageContent(db);
  await seedMyVolunteerInformationContent(db);
}

export async function down(db: Db, _client: MongoClient): Promise<void> {
  await removeActionButtonByHref(db, membersPath, AdminMembersPath.VOLUNTEERS, debugLog);
  await removeActionButtonByHref(db, membersPath, AdminMembersPath.MY_VOLUNTEER_INFORMATION, debugLog);
  await db.collection(PAGE_CONTENT_COLLECTION).deleteOne({path: VOLUNTEER_MAP_CONTENT_PATH});
  await db.collection(PAGE_CONTENT_COLLECTION).deleteOne({path: MY_VOLUNTEER_INFORMATION_CONTENT_PATH});
  debugLog("No-op for volunteer data: it cannot be reduced to the old allocation format without losing history");
}
