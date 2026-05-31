import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-inbox-menu-item");
const TARGET_PATH = "admin#action-buttons";
const CONTENT_TEXT_COLLECTION = "contentText";
const HELP_CATEGORY = "admin";
const HELP_NAME = "inbox-help";

const HELP_CONTENT = `The Inbox reads replies sent to committee role addresses and lets you reply from the role address without leaving NGX.

**Before it works:**
1. Enter the Google OAuth client credentials in **System Settings > External Systems > Mail > Gmail Inbox API**.
2. On this page, connect one or more Gmail mailboxes, map committee role addresses to them, and configure Cloudflare forwarding.

**Day to day:**
- Switch between **Show my inbox messages** and **Show all inbox messages**.
- Open a conversation and select **Reply** to answer from the role address through the unbranded composer.

Full setup notes are in the [Setting up a Gmail inbox for committee replies](https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-05-29-gmail-inbox-setup) article.`;

export async function up(db: Db, client: MongoClient) {
  await addMenuItem(db);
  await addHelpContent(db);
}

async function addMenuItem(db: Db) {
  debugLog("Adding Inbox menu item to admin page");

  const inboxMenuItem = {
    accessLevel: "committee",
    title: "Inbox",
    icon: "faInbox",
    href: "admin/inbox",
    contentText: "Read replies to committee role addresses and reply from the role address"
  };

  const added = await ensureActionButton(db, TARGET_PATH, inboxMenuItem, debugLog);

  if (added) {
    debugLog("Inbox menu item added successfully");
  } else {
    debugLog("Inbox menu item already exists or could not be added");
  }
}

async function addHelpContent(db: Db) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);

  const existing = await collection.findOne({ category: HELP_CATEGORY, name: HELP_NAME });
  if (existing) {
    debugLog(`Help content for ${HELP_NAME} already exists, skipping`);
    return;
  }

  await collection.insertOne({
    category: HELP_CATEGORY,
    name: HELP_NAME,
    text: HELP_CONTENT
  });

  debugLog(`Added help content for ${HELP_NAME}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - Inbox menu item and help content are intentionally left in place");
}
