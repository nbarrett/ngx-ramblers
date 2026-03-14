import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("backfill-booking-email-templates");
const CONFIG_COLLECTION = "config";
const BOOKING_CONFIG_KEY = "booking";

const DEFAULT_TEMPLATES = {
  confirmation: `Hi {{ATTENDEE_NAME}},

Your booking has been confirmed for **{{EVENT_TITLE}}**.

**Date:** {{EVENT_DATE}}

**Places booked:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

If you need to cancel your booking, you can do so from the [event page]({{EVENT_LINK}}) using the email address you booked with.`,

  cancellation: `Hi {{ATTENDEE_NAME}},

Your booking for **{{EVENT_TITLE}}** has been cancelled.

**Date:** {{EVENT_DATE}}

**Places released:** {{PLACES_COUNT}}

**Attendees removed:**

{{ATTENDEE_LIST}}

If this was done in error, you can rebook from the [event page]({{EVENT_LINK}}).`,

  waitlisted: `Hi {{ATTENDEE_NAME}},

Your booking for **{{EVENT_TITLE}}** has been moved to the waiting list.

**Date:** {{EVENT_DATE}}

**Places affected:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

This happened because a member has booked during the member priority period and the event was full. If a place becomes available, your booking will be automatically restored and you will be notified by email.

We apologise for any inconvenience. You can still view the event details on the [event page]({{EVENT_LINK}}).`,

  restored: `Hi {{ATTENDEE_NAME}},

Great news! Your booking for **{{EVENT_TITLE}}** has been restored.

**Date:** {{EVENT_DATE}}

**Places restored:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

A place became available and your booking has been automatically confirmed. No further action is needed. Event details are on the [event page]({{EVENT_LINK}}).`,

  reminder: `Hi {{ATTENDEE_NAME}},

This is a reminder that **{{EVENT_TITLE}}** is coming up soon.

**Date:** {{EVENT_DATE}}

**Places booked:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

View full event details on the [event page]({{EVENT_LINK}}).`
};

const CONTENT_TEXTS_COLLECTION = "contentTexts";
const HELP_ENTRIES = [
  {
    name: "bookings-configuration-help",
    category: "admin",
    text: "* Enable or disable the booking system globally and choose which event types support bookings\n" +
      "* Set default capacity, group size, and member priority days — these apply to all events unless overridden per event\n" +
      "* Configure how many days before an event a reminder email is sent (0 = no reminders)\n" +
      "* Changes only take effect after clicking **Save booking configuration**"
  },
  {
    name: "bookings-email-templates-help",
    category: "admin",
    text: "* Use the toggle buttons to switch between email template types\n" +
      "* Each template supports markdown formatting and placeholders\n" +
      "* Click the **#** button on the toolbar to insert a placeholder at the cursor position\n" +
      "* Available placeholders: **Event Title**, **Event Date**, **Event Link**, **Attendee Name**, **Attendee List**, **Places Count**\n" +
      "* Per-event overrides for confirmation and reminder emails can be set on the Per-Event Detail tab\n" +
      "* If no template is set, a built-in default is used automatically"
  }
];

const DEFAULT_BOOKING_VALUE = {
  enabled: false,
  enabledForEventTypes: ["group-walk", "group-event", "wellbeing-walk"],
  defaultMaxCapacity: 0,
  defaultMaxGroupSize: 3,
  defaultMemberPriorityDays: 0,
  emailTemplates: DEFAULT_TEMPLATES,
  reminderDaysBefore: 0
};

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const bookingConfig = await configCollection.findOne({key: BOOKING_CONFIG_KEY});

  if (bookingConfig?.value?.emailTemplates?.confirmation) {
    debugLog("Email templates already populated — skipping");
    return;
  }

  if (bookingConfig?.value) {
    const result = await configCollection.updateOne(
      {key: BOOKING_CONFIG_KEY},
      {$set: {"value.emailTemplates": DEFAULT_TEMPLATES}}
    );
    debugLog("Backfilled email templates on existing config — matched: %d, modified: %d", result.matchedCount, result.modifiedCount);
  } else {
    await configCollection.updateOne(
      {key: BOOKING_CONFIG_KEY},
      {$set: {key: BOOKING_CONFIG_KEY, value: DEFAULT_BOOKING_VALUE}},
      {upsert: true}
    );
    debugLog("Created booking config with default email templates");
  }

  const contentTextsCollection = db.collection(CONTENT_TEXTS_COLLECTION);
  for (const entry of HELP_ENTRIES) {
    const existingHelp = await contentTextsCollection.findOne({name: entry.name, category: entry.category});
    if (existingHelp) {
      debugLog("Help content \"%s\" already exists — skipping", entry.name);
    } else {
      await contentTextsCollection.insertOne(entry);
      debugLog("Created help content: %s", entry.name);
    }
  }
}

export async function down(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const result = await configCollection.updateOne(
    {key: BOOKING_CONFIG_KEY},
    {$unset: {"value.emailTemplates": 1}}
  );
  debugLog("Removed email templates — matched: %d, modified: %d", result.matchedCount, result.modifiedCount);

  const contentTextsCollection = db.collection(CONTENT_TEXTS_COLLECTION);
  for (const entry of HELP_ENTRIES) {
    await contentTextsCollection.deleteOne({name: entry.name, category: entry.category});
    debugLog("Removed help content: %s", entry.name);
  }
}
