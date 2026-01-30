import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-environment-setup-menu-item");
const TARGET_PATH = "admin#action-buttons";
const CONTENT_TEXT_COLLECTION = "contentText";
const HELP_CATEGORY = "admin";
const HELP_NAME = "environment-setup-help";

const HELP_CONTENT = `This page allows you to provision new NGX-Ramblers environments for Ramblers groups.

**Prerequisites:**
Before starting, ensure you have accounts and access to:
- MongoDB Atlas (database hosting)
- AWS (S3 storage for media files)
- Fly.io (application hosting)
- Brevo (transactional email)
- Ramblers API key (from Ramblers IT)

**Setup Steps:**
1. **Group Selection** - Enter your Ramblers API key and select your group
2. **Services Configuration** - Configure MongoDB, AWS S3, Brevo, and optional Google Maps
3. **Admin User** - Create the initial administrator account
4. **Review** - Validate all settings before creation
5. **Progress** - Monitor the environment creation process

**What Gets Created:**
- S3 bucket for media storage
- IAM user with bucket-specific permissions
- MongoDB database with initial configuration
- Fly.io deployment configuration files

**Note:** This feature is only available on staging environments or when an API key is configured.`;

export async function up(db: Db, client: MongoClient) {
  await addMenuItem(db);
  await addHelpContent(db);
}

async function addMenuItem(db: Db) {
  debugLog("Adding Environment Setup menu item to admin page");

  const environmentSetupMenuItem = {
    accessLevel: "committee",
    title: "Environment Setup",
    icon: "faServer",
    href: "admin/environment-setup",
    contentText: "Provision new NGX-Ramblers environments for Ramblers groups"
  };

  const added = await ensureActionButton(db, TARGET_PATH, environmentSetupMenuItem, debugLog);

  if (added) {
    debugLog("Environment Setup menu item added successfully");
  } else {
    debugLog("Environment Setup menu item already exists or could not be added");
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
  debugLog("No down migration - Environment Setup menu item and help content are intentionally left in place");
}
