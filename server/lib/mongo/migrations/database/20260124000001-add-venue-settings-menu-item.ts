import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-venue-settings-menu-item");
const TARGET_PATH = "admin#action-buttons";
const CONTENT_TEXT_COLLECTION = "contentText";
const HELP_CATEGORY = "admin";
const HELP_NAME = "venue-settings-help";

const HELP_CONTENT = `This page allows you to manage the stored venues used across the walks programme.

**Features:**
- **Search**: Filter venues by name, address, or postcode
- **Filter by Type**: Show only venues of a specific type (pub, cafe, car park, etc.)
- **Re-detect Types**: Automatically infer venue types from their names
- **Geocode**: Get coordinates from postcodes for venues missing location data

**Venue Types:**
Venues are automatically categorised based on keywords in their names. Click the map marker icon to geocode a venue from its postcode.

**Distance Display:**
When selecting venues in walk editing, distances are shown from the walk's starting point (if coordinates are available).`;

export async function up(db: Db, client: MongoClient) {
  await addMenuItem(db);
  await addHelpContent(db);
}

async function addMenuItem(db: Db) {
  debugLog("Adding Venue Settings menu item to admin page");

  const venueSettingsMenuItem = {
    accessLevel: "committee",
    title: "Venue Settings",
    icon: "faMapMarkerAlt",
    href: "admin/venue-settings",
    contentText: "Manage stored venues used for walk meeting points and post-walk pubs"
  };

  const added = await ensureActionButton(db, TARGET_PATH, venueSettingsMenuItem, debugLog);

  if (added) {
    debugLog("Venue Settings menu item added successfully");
  } else {
    debugLog("Venue Settings menu item already exists or could not be added");
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
  debugLog("No down migration - Venue Settings menu item and help content are intentionally left in place");
}
