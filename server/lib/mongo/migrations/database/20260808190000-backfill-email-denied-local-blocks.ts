import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { dateTimeNowAsValue } from "../../../shared/dates";

const debugLog = createMigrationLogger("backfill-email-denied-local-blocks");

const AUDIT_SOURCES = ["brevo-events-webhook", "brevo-unsubscribes-sync", "brevo-email-denied-sync"];
const REASON_FROM_AUDIT = /(spam|complaint|unsubscribed|hard bounce|blocked|email denied)/i;

function reasonCodeFromAudit(audit: unknown): {code: string; message?: string} {
  const text = typeof audit === "string" ? audit : "";
  if (/spam|complaint/i.test(text)) {
    return {code: "contactFlaggedAsSpam", message: text || undefined};
  }
  if (/hard bounce/i.test(text)) {
    return {code: "hardBounce", message: text || undefined};
  }
  if (/unsubscribed/i.test(text)) {
    return {code: "unsubscribedViaEmail", message: text || undefined};
  }
  if (/email denied/i.test(text)) {
    return {code: "emailDenied", message: text || undefined};
  }
  return {code: "adminBlocked", message: text || undefined};
}

async function backfillMember(
  members: ReturnType<Db["collection"]>,
  memberId: string,
  latest: {timestamp: number; audit: unknown; createdBy: string},
  progress: {updated: number; skipped: number; missing: number}
): Promise<void> {
  const objectId = ObjectId.isValid(memberId) ? new ObjectId(memberId) : null;
  if (!objectId) {
    progress.missing += 1;
  } else {
    const memberDoc = await members.findOne(
      {_id: objectId},
      {projection: {emailBlock: 1, mail: 1, email: 1}}
    );
    if (!memberDoc) {
      progress.missing += 1;
    } else if (memberDoc.emailBlock) {
      progress.skipped += 1;
    } else {
      const reason = reasonCodeFromAudit(latest.audit);
      const subscriptions = Array.isArray(memberDoc.mail?.subscriptions)
        ? memberDoc.mail.subscriptions.map((subscription: {id: number; subscribed: boolean; unsubscribedAt?: number}) =>
          subscription.subscribed
            ? {...subscription, subscribed: false, unsubscribedAt: latest.timestamp}
            : subscription
        )
        : [];
      await members.updateOne(
        {_id: objectId},
        {
          $set: {
            emailBlock: {
              reasonCode: reason.code,
              reasonMessage: reason.message,
              blockedAt: latest.timestamp,
              syncedAt: dateTimeNowAsValue(),
              source: latest.createdBy
            },
            ...(subscriptions.length > 0 ? {"mail.subscriptions": subscriptions} : {})
          }
        }
      );
      progress.updated += 1;
    }
  }
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const audits = db.collection("mailListAudit");
  const members = db.collection("members");
  const rows = await audits.find({
    createdBy: {$in: AUDIT_SOURCES},
    $or: [
      {listType: "brevo-blocked"},
      {audit: {$regex: REASON_FROM_AUDIT}}
    ]
  }).project({memberId: 1, timestamp: 1, audit: 1, createdBy: 1}).sort({timestamp: -1}).toArray();

  const latestByMember = new Map<string, {timestamp: number; audit: unknown; createdBy: string}>();
  rows.forEach(row => {
    const memberId = row.memberId?.toString?.() || row.memberId;
    if (!memberId || latestByMember.has(memberId)) {
      return;
    }
    latestByMember.set(memberId, {
      timestamp: Number(row.timestamp) || dateTimeNowAsValue(),
      audit: row.audit,
      createdBy: String(row.createdBy || "brevo-events-webhook")
    });
  });

  const progress = {updated: 0, skipped: 0, missing: 0, datesCorrected: 0};
  await Array.from(latestByMember.entries()).reduce(
    (previous, [memberId, latest]) => previous.then(() => backfillMember(members, memberId, latest, progress)),
    Promise.resolve()
  );

  const genericDenied = await members.find({
    "emailBlock.reasonCode": "emailDenied",
    "emailBlock.source": {$in: ["brevo-email-denied-sync", "brevo-unsubscribes-sync"]}
  }).project({_id: 1, email: 1, emailBlock: 1}).toArray();

  await genericDenied.reduce(async (previous, memberDoc) => {
    await previous;
    const memberId = memberDoc._id?.toString?.() || memberDoc._id;
    const auditLatest = memberId ? latestByMember.get(memberId) : null;
    if (auditLatest && memberDoc.emailBlock?.blockedAt !== auditLatest.timestamp) {
      const reason = reasonCodeFromAudit(auditLatest.audit);
      await members.updateOne(
        {_id: memberDoc._id},
        {
          $set: {
            "emailBlock.blockedAt": auditLatest.timestamp,
            "emailBlock.reasonCode": reason.code,
            "emailBlock.reasonMessage": reason.message,
            "emailBlock.syncedAt": dateTimeNowAsValue(),
            "emailBlock.source": auditLatest.createdBy
          }
        }
      );
      progress.datesCorrected += 1;
    }
  }, Promise.resolve());

  debugLog(
    "backfill email blocks from audit: updated=%d skipped-with-block=%d missing-member=%d dates-corrected=%d candidates=%d",
    progress.updated,
    progress.skipped,
    progress.missing,
    progress.datesCorrected,
    latestByMember.size
  );
  debugLog(
    "remaining Brevo global email-denied contacts without an audit row get event dates from campaign/transactional history on the next Mail Settings → Blocks sync or unsubscribes cron"
  );
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("No-op: email block backfill is non-destructive");
}
