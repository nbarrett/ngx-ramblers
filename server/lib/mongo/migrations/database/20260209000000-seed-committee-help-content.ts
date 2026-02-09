import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("seed-committee-help-content");
const CONTENT_TEXT_COLLECTION = "contentTexts";

const COMMITTEE_HELP_ENTRIES = [
  {
    name: "committee-role-details-help",
    category: "admin",
    text: "* **Member** — select the group member who holds this role. If the role is currently unfilled, tick **Role is vacant**.\n" +
      "* **Full Name** — the display name shown on the website and in emails. This is pre-filled from the selected member but can be overridden.\n" +
      "* **Role Description** — a short label for the role (e.g. _Chairman_, _Walks Secretary_). This also determines the role's URL-friendly type code.\n" +
      "* **Role Type** — choose *Committee*, *Group* or *System* to categorise the role.\n" +
      "* **Maps to Built-in Role** — link this role to a built-in function so the system knows which member should receive process-related emails (e.g. membership notifications).\n" +
      "* **Role is vacant** — tick this to clear the member assignment and disable email-related fields until a new member is assigned."
  },
  {
    name: "committee-outbound-email-help",
    category: "admin",
    text: "* The **Sender Email** is the address that appears in the *From* field when emails are sent on behalf of this role.\n" +
      "* It can be derived automatically from the **Role** name (e.g. `walks-secretary@yourdomain.org.uk`) or from the member's **Full Name** (e.g. `john.smith@yourdomain.org.uk`).\n" +
      "* The email address must use your group's domain — addresses on other domains will be rejected by Brevo.\n" +
      "* Use the **Create or Amend Sender** section below to register or verify the sender in Brevo. A sender must be verified before emails can be sent from this address."
  },
  {
    name: "committee-inbound-forwarding-help",
    category: "admin",
    text: "* Controls where incoming emails sent to this role's address are delivered.\n" +
      "* **Member's personal email** — forwards to the email address stored on the member's record.\n" +
      "* **Custom address** — forwards to a specific email address you enter.\n" +
      "* **Multiple recipients** — forwards to several addresses using a Cloudflare Email Worker. Recipients can be selected from existing members or added manually.\n" +
      "* **No forwarding** — disables inbound forwarding for this role.\n" +
      "* The **Email Routing Status** section below shows whether the Cloudflare routing rule and destination addresses are correctly configured."
  },
  {
    name: "committee-contact-us-help",
    category: "admin",
    text: "* Configures how the **Contact Us** form routes messages for this role.\n" +
      "* The forwarding target options work the same way as the Inbound Forwarding tab — choose between the member's personal email, a custom address, or multiple recipients.\n" +
      "* The **Contact Link** section provides a markdown link that can be embedded in page content to direct visitors to the Contact Us form pre-filled with this role, e.g. `[Contact John](?contact-us&role=walks-secretary&redirect=...)`."
  },
  {
    name: "committee-email-logs-help",
    category: "admin",
    text: "* Displays email routing logs from Cloudflare Workers for this role's email address.\n" +
      "* Use this tab to verify that inbound emails are being received and forwarded correctly.\n" +
      "* Logs show the sender, recipient, timestamp and delivery status for each processed message.\n" +
      "* This tab only appears when a Cloudflare Worker script is actively handling email for this role."
  }
];

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);

  for (const entry of COMMITTEE_HELP_ENTRIES) {
    const existing = await collection.findOne({ name: entry.name, category: entry.category });
    if (existing) {
      debugLog(`Content text "${entry.name}" already exists, skipping`);
      continue;
    }
    await collection.insertOne(entry);
    debugLog(`Added content text: ${entry.name}`);
  }
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  for (const entry of COMMITTEE_HELP_ENTRIES) {
    await collection.deleteOne({ name: entry.name, category: entry.category });
    debugLog(`Removed content text: ${entry.name}`);
  }
}
