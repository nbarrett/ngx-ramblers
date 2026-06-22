import { toPairs, isObject, isString, keys, values } from "es-toolkit/compat";
import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { BOOKING_EMAIL_BLOCK_KEYS } from "../../../brevo/transactional-mail/booking-template-resolver";
import { BookingEmailType } from "../../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import {
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { editableBodyMarkdown } from "../../../brevo/templates/editable-body";

const debugLog = createMigrationLogger("version-controlled-email-template-data");

const EXTENDED_GROUP_EVENT_COLLECTION = "extendedGroupEvents";
const BOOKING_CONFIG_KEY = "booking";
const BOOKING_NOTIFICATION_SUBJECT = "Booking Notification";
const DEFAULT_TEMPLATE_NAME = "fully-automated-text-body";

const SUBJECT_TO_TEMPLATE_NAME: Record<string, string> = {
  "Welcome to The Group": "welcome-to-the-group",
  "Website Password Reset Instructions": "website-and-login-details",
  "Forgotten Password Reset": "website-and-login-details",
  "Your NGX-Ramblers Login": "website-and-login-details",
  "Expired Membership": "membership-expiry",
  "Expired Members Warning": "membership-expiry-warning"
};

function templateNameForSubject(subjectText: string | undefined): string {
  return (subjectText && SUBJECT_TO_TEMPLATE_NAME[subjectText]) || DEFAULT_TEMPLATE_NAME;
}

function rewriteBookingTokens(markdown: string): string {
  return markdown.replace(
    /\{\{(EVENT_TITLE|EVENT_DATE|EVENT_LINK|ATTENDEE_NAME|ATTENDEE_LIST|PLACES_COUNT)}}/g,
    "{{params.bookingMergeFields.$1}}"
  );
}

function alreadyConverted(value: string): boolean {
  return value.includes("params.bookingMergeFields");
}

async function populateTemplateName(db: Db): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configs = await collection.find({}).toArray();
  let updatedCount = 0;
  for (const config of configs) {
    const templateName = templateNameForSubject(config.subject?.text);
    if (config.templateName === templateName) {
      continue;
    }
    await collection.updateOne({_id: config._id}, {$set: {templateName}});
    updatedCount++;
  }
  debugLog(`Populated templateName on ${updatedCount} of ${configs.length} notification configs`);
}

async function convertOverridesToTypedShape(db: Db): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configs = await collection.find({templateOverrides: {$exists: true, $ne: null}}).toArray();
  let updatedCount = 0;
  for (const config of configs) {
    const overrides: Record<string, any> = config.templateOverrides || {};
    const converted: Record<string, any> = {};
    let changed = false;
    for (const [key, value] of toPairs(overrides)) {
      if (isString(value)) {
        converted[key] = {type: TemplateOverrideType.IMAGE, state: TemplateOverrideState.CUSTOM, imageUrl: value};
        changed = true;
      } else {
        converted[key] = value;
      }
    }
    if (changed) {
      await collection.updateOne({_id: config._id}, {$set: {templateOverrides: converted}});
      updatedCount++;
    }
  }
  debugLog(`Converted templateOverrides to the typed shape on ${updatedCount} of ${configs.length} notification configs`);
}

async function migrateBookingTemplatesToContentBlocks(db: Db): Promise<void> {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const bookingConfigDoc = await db.collection(CONFIG_COLLECTION).findOne({key: BOOKING_CONFIG_KEY});
  const emailTemplates: Record<string, string> = bookingConfigDoc?.value?.emailTemplates || {};
  const bookingNotificationConfig = await notificationConfigs.findOne({"subject.text": BOOKING_NOTIFICATION_SUBJECT});

  if (bookingNotificationConfig && keys(emailTemplates).length > 0) {
    const templateOverrides: Record<string, any> = {...(bookingNotificationConfig.templateOverrides || {})};
    let movedCount = 0;
    for (const emailType of values(BookingEmailType)) {
      const markdown = emailTemplates[emailType];
      if (markdown && !alreadyConverted(markdown)) {
        templateOverrides[BOOKING_EMAIL_BLOCK_KEYS[emailType]] = {
          type: TemplateOverrideType.CONTENT,
          state: TemplateOverrideState.CUSTOM,
          content: rewriteBookingTokens(markdown)
        };
        movedCount++;
      }
    }
    if (movedCount > 0) {
      await notificationConfigs.updateOne({_id: bookingNotificationConfig._id}, {$set: {templateOverrides}});
      debugLog(`Moved ${movedCount} custom booking email template(s) onto the Booking Notification config as content blocks`);
    }
  }

  const events = db.collection(EXTENDED_GROUP_EVENT_COLLECTION);
  const eventsWithOverrides = await events.find({"fields.bookingEmailOverrides": {$exists: true, $ne: null}}).toArray();
  let convertedEventCount = 0;
  for (const event of eventsWithOverrides) {
    const overrides: Record<string, string> = event.fields?.bookingEmailOverrides || {};
    const converted: Record<string, string> = {};
    let changed = false;
    for (const [emailType, value] of toPairs(overrides)) {
      if (isString(value) && value.trim() && !alreadyConverted(value)) {
        converted[emailType] = rewriteBookingTokens(value);
        changed = true;
      } else {
        converted[emailType] = value;
      }
    }
    if (changed) {
      await events.updateOne({_id: event._id}, {$set: {"fields.bookingEmailOverrides": converted}});
      convertedEventCount++;
    }
  }
  debugLog(`Rewrote booking placeholder tokens in per-event email overrides on ${convertedEventCount} events`);
}

async function populateConfigBody(db: Db): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configs = await collection.find({templateName: {$exists: true, $ne: null}}).toArray();
  let updatedCount = 0;
  for (const config of configs) {
    if (config.subject?.text === BOOKING_NOTIFICATION_SUBJECT) {
      continue;
    }
    if (isString(config.body) && config.body.length > 0) {
      continue;
    }
    const body = editableBodyMarkdown(config.templateName, config.templateOverrides);
    if (body) {
      await collection.updateOne({_id: config._id}, {$set: {body}});
      updatedCount++;
    }
  }
  debugLog(`Populated body on ${updatedCount} of ${configs.length} notification configs (templateOverrides kept as backup)`);
}

export async function up(db: Db) {
  await populateTemplateName(db);
  await convertOverridesToTypedShape(db);
  await migrateBookingTemplatesToContentBlocks(db);
  await populateConfigBody(db);
}

async function revertOverridesToPlainUrls(db: Db): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configs = await collection.find({templateOverrides: {$exists: true, $ne: null}}).toArray();
  for (const config of configs) {
    const overrides: Record<string, any> = config.templateOverrides || {};
    const reverted: Record<string, any> = {};
    let changed = false;
    for (const [key, value] of toPairs(overrides)) {
      const imageOverride = value as { imageUrl?: string };
      if (isObject(value) && isString(imageOverride.imageUrl)) {
        reverted[key] = imageOverride.imageUrl;
        changed = true;
      } else {
        reverted[key] = value;
      }
    }
    if (changed) {
      await collection.updateOne({_id: config._id}, {$set: {templateOverrides: reverted}});
    }
  }
}

export async function down(db: Db) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);

  const bodyResult = await notificationConfigs.updateMany({}, {$unset: {body: ""}});
  debugLog(`Removed body from ${bodyResult.modifiedCount} notification configs`);

  const bookingNotificationConfig = await notificationConfigs.findOne({"subject.text": BOOKING_NOTIFICATION_SUBJECT});
  if (bookingNotificationConfig?.templateOverrides) {
    const templateOverrides: Record<string, any> = {...bookingNotificationConfig.templateOverrides};
    for (const blockKey of values(BOOKING_EMAIL_BLOCK_KEYS)) {
      delete templateOverrides[blockKey];
    }
    await notificationConfigs.updateOne({_id: bookingNotificationConfig._id}, {$set: {templateOverrides}});
  }

  await revertOverridesToPlainUrls(db);

  const templateNameResult = await notificationConfigs.updateMany({}, {$unset: {templateName: ""}});
  debugLog(`Removed templateName from ${templateNameResult.modifiedCount} notification configs`);
}
