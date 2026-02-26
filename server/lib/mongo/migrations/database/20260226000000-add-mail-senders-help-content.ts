import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("add-mail-senders-help-content");
const CONTENT_TEXT_COLLECTION = "contentTexts";
const HELP_NAME = "mail-settings-senders-help";
const HELP_CATEGORY = "admin";
const HELP_TEXT = "* Use this tab to manage Brevo sender identities used for outbound email.\n" +
  "* Sender addresses should use your website domain and should map to committee roles where possible.\n" +
  "* The **Authenticate Domain** action checks domain authentication status and attempts to complete Brevo domain authentication.\n" +
  "* If Brevo cannot complete authentication automatically, follow the provided link to complete the final step in Brevo.";

export async function up(db: Db, _client: MongoClient) {
  const contentTexts = db.collection(CONTENT_TEXT_COLLECTION);
  const existing = await contentTexts.findOne({ name: HELP_NAME, category: HELP_CATEGORY });
  if (existing) {
    await contentTexts.updateOne(
      { _id: existing._id },
      { $set: { text: HELP_TEXT } }
    );
    debugLog(`Updated content text: ${HELP_NAME}`);
    return;
  }
  await contentTexts.insertOne({
    name: HELP_NAME,
    category: HELP_CATEGORY,
    text: HELP_TEXT
  });
  debugLog(`Added content text: ${HELP_NAME}`);
}

export async function down(db: Db, _client: MongoClient) {
  const contentTexts = db.collection(CONTENT_TEXT_COLLECTION);
  await contentTexts.deleteOne({ name: HELP_NAME, category: HELP_CATEGORY });
  debugLog(`Removed content text: ${HELP_NAME}`);
}
