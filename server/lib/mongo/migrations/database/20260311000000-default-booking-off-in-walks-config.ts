import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton, removeActionButtonByHref } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("default-booking-off-in-walks-config");
const CONFIG_COLLECTION = "config";
const NOTIFICATION_CONFIGS_COLLECTION = "notificationConfigs";
const BOOKING_CONFIG_KEY = "booking";
const WALKS_CONFIG_KEY = "walks";
const BREVO_CONFIG_KEY = "brevo";
const BOOKING_NOTIFICATION_SUBJECT = "Booking Notification";

const DEFAULT_BOOKING = {
  enabled: false,
  enabledForEventTypes: ["group-walk", "group-event", "wellbeing-walk"],
  defaultMaxCapacity: 0,
  defaultMaxGroupSize: 3,
  defaultMemberPriorityDays: 0
};

const NEWSLETTER_SUBJECT = "Newsletter";
const ADMIN_ACTION_BUTTONS_PATH = "admin#action-buttons";
const CONTENT_TEXTS_COLLECTION = "contentTexts";
const HELP_ENTRIES = [
  {
    name: "bookings-summary-help",
    category: "admin",
    text: "* View a summary of all events that have bookings enabled\n" +
      "* Click on an event row to jump to the per-event detail view\n" +
      "* Download a CSV report of the summary data"
  },
  {
    name: "bookings-detail-help",
    category: "admin",
    text: "* Select an event to view individual bookings and attendee details\n" +
      "* Waitlisted bookings are highlighted and shown with a status badge\n" +
      "* Download a CSV of attendees for the selected event\n" +
      "* Delete individual bookings if needed"
  }
];
const BOOKINGS_MENU_ITEM = {
  accessLevel: "committee",
  title: "Bookings",
  icon: "faTicket",
  href: "admin/bookings",
  contentText: "View and manage event bookings, attendee lists, and download CSV reports"
};

async function migrateCcRolesToBccRoles(db: Db) {
  const notificationConfigsCollection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  const configsWithCcRoles = await notificationConfigsCollection.find({
    ccRoles: {$exists: true, $ne: []}
  }).toArray();

  for (const config of configsWithCcRoles) {
    const existingBccRoles = Array.isArray(config.bccRoles) ? config.bccRoles : [];
    const ccRoles = Array.isArray(config.ccRoles) ? config.ccRoles : [];
    const bccRoles = existingBccRoles.length > 0 ? existingBccRoles : ccRoles;
    await notificationConfigsCollection.updateOne(
      {_id: config._id},
      {
        $set: {bccRoles},
        $unset: {ccRoles: 1}
      }
    );
    debugLog("Migrated ccRoles to bccRoles for notification config %s", config._id);
  }
}

async function migrateBccRolesToCcRoles(db: Db) {
  const notificationConfigsCollection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  const configsWithBccRoles = await notificationConfigsCollection.find({
    bccRoles: {$exists: true, $ne: []}
  }).toArray();

  for (const config of configsWithBccRoles) {
    const existingCcRoles = Array.isArray(config.ccRoles) ? config.ccRoles : [];
    const bccRoles = Array.isArray(config.bccRoles) ? config.bccRoles : [];
    const ccRoles = existingCcRoles.length > 0 ? existingCcRoles : bccRoles;
    await notificationConfigsCollection.updateOne(
      {_id: config._id},
      {
        $set: {ccRoles},
        $unset: {bccRoles: 1}
      }
    );
    debugLog("Migrated bccRoles to ccRoles for notification config %s", config._id);
  }
}

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const walksConfig = await configCollection.findOne({key: WALKS_CONFIG_KEY});
  const bookingConfig = await configCollection.findOne({key: BOOKING_CONFIG_KEY});

  if (bookingConfig?.value) {
    const enabledForEventTypes = Array.isArray(bookingConfig.value?.enabledForEventTypes) && bookingConfig.value.enabledForEventTypes.length > 0
      ? bookingConfig.value.enabledForEventTypes
      : DEFAULT_BOOKING.enabledForEventTypes;
    await configCollection.updateOne(
      {key: BOOKING_CONFIG_KEY},
      {$set: {"value.enabledForEventTypes": enabledForEventTypes}}
    );
    debugLog("Booking config already exists — normalised enabled booking event types");
  } else {
    await configCollection.updateOne(
      {key: BOOKING_CONFIG_KEY},
      {
        $set: {
          key: BOOKING_CONFIG_KEY,
          value: {
            ...DEFAULT_BOOKING,
            ...(walksConfig?.value?.booking || {})
          }
        }
      },
      {upsert: true}
    );
    debugLog("Created global booking config");
  }

  if (walksConfig?.value?.booking !== undefined) {
    await configCollection.updateOne(
      {key: WALKS_CONFIG_KEY},
      {$unset: {"value.booking": 1}}
    );
    debugLog("Removed booking settings from walks config");
  }

  const notificationConfigsCollection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  await migrateCcRolesToBccRoles(db);
  const existing = await notificationConfigsCollection.findOne({"subject.text": BOOKING_NOTIFICATION_SUBJECT});
  if (existing) {
    debugLog("Booking Notification config already exists — skipping");
  } else {
    const newsletter = await notificationConfigsCollection.findOne({"subject.text": {$regex: NEWSLETTER_SUBJECT, $options: "i"}});
    if (newsletter) {
      debugLog("Using Newsletter config as reference: senderRole=%s, replyToRole=%s, templateId=%s, bannerId=%s",
        newsletter.senderRole, newsletter.replyToRole, newsletter.templateId, newsletter.bannerId);
    } else {
      debugLog("No Newsletter config found — using first available config as reference");
    }
    const reference = newsletter || await notificationConfigsCollection.findOne({});
    const committeeConfig = await configCollection.findOne({key: "committee"});
    const allRoles: string[] = (committeeConfig?.value?.roles || []).map((r: any) => r.type).filter(Boolean);
    const walksRoles = allRoles.filter((role: string) => role.toLowerCase().includes("walk"));
    const signOffRoles = walksRoles.length > 0 ? walksRoles : (reference?.signOffRoles || ["membership"]);
    const senderRole = walksRoles[0] || reference?.senderRole || "membership";
    const replyToRole = walksRoles[0] || reference?.replyToRole || "membership";
    debugLog("Committee roles containing 'walks': %o, senderRole: %s, replyToRole: %s", walksRoles, senderRole, replyToRole);
    const bookingConfig = {
      subject: {
        prefixParameter: "systemMergeFields.APP_SHORTNAME",
        text: BOOKING_NOTIFICATION_SUBJECT,
        suffixParameter: null
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: reference?.defaultMemberSelection || "recently-added",
      monthsInPast: 1,
      templateId: reference?.templateId || null,
      senderRole,
      replyToRole,
      bccRoles: reference?.bccRoles || reference?.ccRoles || [],
      signOffRoles,
      bannerId: reference?.bannerId || null
    };
    const insertResult = await notificationConfigsCollection.insertOne(bookingConfig);
    debugLog("Created Booking Notification config — senderRole: %s, replyToRole: %s, templateId: %s, bannerId: %s", bookingConfig.senderRole, bookingConfig.replyToRole, bookingConfig.templateId, bookingConfig.bannerId);

    const brevoConfig = await configCollection.findOne({key: BREVO_CONFIG_KEY});
    if (brevoConfig && !brevoConfig.value?.bookingNotificationConfigId) {
      await configCollection.updateOne(
        {key: BREVO_CONFIG_KEY},
        {$set: {"value.bookingNotificationConfigId": insertResult.insertedId.toString()}}
      );
      debugLog("Wired bookingNotificationConfigId %s into brevo config", insertResult.insertedId);
    }
  }

  await ensureActionButton(db, ADMIN_ACTION_BUTTONS_PATH, BOOKINGS_MENU_ITEM, debugLog);

  const contentTextsCollection = db.collection(CONTENT_TEXTS_COLLECTION);
  for (const entry of HELP_ENTRIES) {
    const existing = await contentTextsCollection.findOne({name: entry.name, category: entry.category});
    if (existing) {
      debugLog("Help content \"%s\" already exists — skipping", entry.name);
    } else {
      await contentTextsCollection.insertOne(entry);
      debugLog("Created help content: %s", entry.name);
    }
  }
}

export async function down(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  await migrateBccRolesToCcRoles(db);
  const bookingConfig = await configCollection.findOne({key: BOOKING_CONFIG_KEY});
  if (bookingConfig?.value) {
    await configCollection.updateOne(
      {key: WALKS_CONFIG_KEY},
      {$set: {"value.booking": bookingConfig.value}}
    );
    debugLog("Restored booking settings into walks config");
  }
  await configCollection.deleteOne({key: BOOKING_CONFIG_KEY});
  debugLog("Removed global booking config");

  await configCollection.updateOne(
    {key: BREVO_CONFIG_KEY},
    {$unset: {"value.bookingNotificationConfigId": 1}}
  );
  debugLog("Removed bookingNotificationConfigId from brevo config");

  const notificationConfigsCollection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  await notificationConfigsCollection.deleteOne({"subject.text": BOOKING_NOTIFICATION_SUBJECT});
  debugLog("Removed Booking Notification config");

  await removeActionButtonByHref(db, ADMIN_ACTION_BUTTONS_PATH, BOOKINGS_MENU_ITEM.href, debugLog);

  const contentTextsCollection = db.collection(CONTENT_TEXTS_COLLECTION);
  for (const entry of HELP_ENTRIES) {
    await contentTextsCollection.deleteOne({name: entry.name, category: entry.category});
  }
  debugLog("Removed booking help content");
}
