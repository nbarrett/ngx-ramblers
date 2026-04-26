import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

import { CONTENT_TEXT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("seed-mail-settings-unsubscribes-help");

const HELP_ENTRY = {
  name: "mail-settings-unsubscribes-help",
  category: "admin",
  text:
    "## Brevo Unsubscribes & Blocked Contacts\n\n" +
    "This view lists every contact that Brevo is currently suppressing — anyone who unsubscribed via an email link, the Brevo unsubscribe page, or the Brevo API, plus contacts blocked by an admin, hard-bounced or flagged as spam.\n\n" +
    "### What it shows\n" +
    "* **Contact Email** — the blocked contact's address. Click it to open their record in Brevo in a new tab.\n" +
    "* **Sender Email** — the sender against which the block was registered (relevant for transactional events).\n" +
    "* **Reason** — Brevo's classification of the block. Hard bounces and spam flags are highlighted in red; admin and email-link unsubscribes in their own colours.\n" +
    "* **Matched Member** — the local NGX member matched by email (if any), with the membership number for cross-reference.\n" +
    "* **Lists** — the Brevo list memberships that were active when the block was last synced. \"Blocked from receiving email\" appears below if Brevo has set the contact's global blacklist flag.\n" +
    "* **Blocked At** — when Brevo recorded the block.\n" +
    "* **Salesforce** — writeback status for the future Ramblers HQ Salesforce consent integration. _Pending_ rows are queued for writeback once the Salesforce consent endpoint is wired.\n\n" +
    "### Side effects of opening this page\n" +
    "* Each row that matches an NGX member writes a `mailListAudit` row keyed by `(memberId, listId, blockedAt)` so the block becomes part of that member's permanent audit trail (visible on the **Brevo** tab of the member admin modal).\n" +
    "* Each matched member's `emailBlock` summary is updated to reflect the latest Brevo state.\n" +
    "* The contact's NGX `mail.subscriptions` are flipped to **unsubscribed** for the lists Brevo holds them on, so the local view matches reality.\n\n" +
    "### Filters\n" +
    "* **Search** is client-side and filters across contact email, sender email, and reason text.\n" +
    "* **Reason**, **Sender**, **Blocked from**, and **Blocked to** are server-side filters — applying them re-fetches a narrowed set from Brevo. Combine date filters with **Blocked from** ≤ **Blocked to**. Click **Clear filters** to reset.\n\n" +
    "### Actions\n" +
    "* **Remove from blocklist** — calls `DELETE /smtp/blockedContacts/{email}` against Brevo, then clears the matched member's local `emailBlock` and writes an audit row recording the manual override. Subscription state on the member is **not** changed automatically — re-subscribe explicitly via the member's Brevo tab if appropriate.\n\n" +
    "### Automation\n" +
    "* A scheduled cron job runs this sync periodically (every two hours) so the data here stays current without an admin opening the page.\n" +
    "* A Brevo webhook endpoint (`POST /api/mail/webhooks/brevo-events?token=...`) writes the same audit and `emailBlock` updates in real time when Brevo emits `unsubscribed`, `blocked`, `hard_bounce`, `spam`, or `complaint` events. Configure the webhook URL inside Brevo's account settings.\n\n" +
    "### Bulk-import safety\n" +
    "When a Ramblers HQ CSV is re-imported, members already flagged with `emailBlock` are still updated, but they will not be auto-subscribed to mail lists regardless of what HQ's `Email Marketing Consent` column says. The local block is the source of truth for outbound deliverability."
};

export async function up(db: Db, _client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  const existing = await collection.findOne({ name: HELP_ENTRY.name, category: HELP_ENTRY.category });
  if (existing) {
    debugLog(`Content text "${HELP_ENTRY.name}" already exists, skipping`);
    return;
  }
  await collection.insertOne(HELP_ENTRY);
  debugLog(`Added content text: ${HELP_ENTRY.name}`);
}

export async function down(db: Db, _client: MongoClient) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await collection.deleteOne({ name: HELP_ENTRY.name, category: HELP_ENTRY.category });
  debugLog(`Removed content text: ${HELP_ENTRY.name}`);
}
