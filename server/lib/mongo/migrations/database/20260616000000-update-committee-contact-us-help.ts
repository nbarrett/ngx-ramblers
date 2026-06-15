import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

import { CONTENT_TEXT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("update-committee-contact-us-help");

const NAME = "committee-contact-us-help";
const CATEGORY = "admin";

const UPDATED_TEXT = "* Configures how the **Contact Us** form routes messages for this role.\n" +
  "* When this role forwards to a connected inbox (set on the **Inbound Forwarding** tab), contact-us is handled automatically — messages go to the role's own address and appear in your inbox grouped under the role, with nothing to configure here.\n" +
  "* Otherwise, choose where submissions go: the linked member's personal email, the role's own address, a custom address, multiple recipients, the catch-all, or disable contact-us for this role.\n" +
  "* The **Contact Link** section provides a markdown link you can embed in page content to send visitors to the Contact Us form pre-filled with this role, e.g. `[Contact John](?contact-us&role=walks-secretary&redirect=...)`.";

const PREVIOUS_TEXT = "* Configures how the **Contact Us** form routes messages for this role.\n" +
  "* The forwarding target options work the same way as the Inbound Forwarding tab — choose between the member's personal email, a custom address, or multiple recipients.\n" +
  "* The **Contact Link** section provides a markdown link that can be embedded in page content to direct visitors to the Contact Us form pre-filled with this role, e.g. `[Contact John](?contact-us&role=walks-secretary&redirect=...)`.";

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  const result = await collection.updateOne(
    { name: NAME, category: CATEGORY },
    { $set: { name: NAME, category: CATEGORY, text: UPDATED_TEXT } },
    { upsert: true });
  debugLog(`Updated content text "${NAME}" (matched ${result.matchedCount}, upserted ${result.upsertedCount})`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await collection.updateOne(
    { name: NAME, category: CATEGORY },
    { $set: { name: NAME, category: CATEGORY, text: PREVIOUS_TEXT } },
    { upsert: true });
  debugLog(`Reverted content text "${NAME}" to previous wording`);
}
