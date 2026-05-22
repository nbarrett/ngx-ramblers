import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("backfill-subscription-unsubscribed-at");
debugLog.enabled = true;

const BRANDED_UNSUBSCRIBE = "branded-unsubscribe";

interface MailSubscription {
  id: number;
  subscribed?: boolean;
  unsubscribedAt?: number;
}

export async function up(db: Db, client: MongoClient) {
  const audits = db.collection("mailListAudit");
  const members = db.collection("members");

  const unsubscribeAudits = await audits
    .find({ createdBy: BRANDED_UNSUBSCRIBE }, { projection: { memberId: 1, listId: 1, timestamp: 1 } })
    .toArray();
  debugLog(`Found ${unsubscribeAudits.length} branded-unsubscribe audit entries`);

  const perListByMember = new Map<string, Map<number, number>>();
  const globalByMember = new Map<string, number>();
  unsubscribeAudits.forEach(audit => {
    const memberId: string = audit.memberId;
    const listId: number = audit.listId;
    const timestamp: number = audit.timestamp;
    if (!memberId || !Number.isFinite(timestamp)) {
      return;
    }
    if (listId === 0) {
      globalByMember.set(memberId, Math.max(globalByMember.get(memberId) ?? 0, timestamp));
    } else if (Number.isFinite(listId)) {
      const byList = perListByMember.get(memberId) ?? new Map<number, number>();
      byList.set(listId, Math.max(byList.get(listId) ?? 0, timestamp));
      perListByMember.set(memberId, byList);
    }
  });

  const affectedMemberIds = new Set<string>([...perListByMember.keys(), ...globalByMember.keys()]);
  debugLog(`Branded unsubscribe history affects ${affectedMemberIds.size} members`);

  let updated = 0;
  let skippedNoMember = 0;
  let skippedNoChange = 0;
  for (const memberId of affectedMemberIds) {
    if (!ObjectId.isValid(memberId)) {
      skippedNoMember++;
      continue;
    }
    const member = await members.findOne({ _id: new ObjectId(memberId) }, { projection: { "mail.subscriptions": 1 } });
    const subscriptions: MailSubscription[] = member?.mail?.subscriptions ?? [];
    if (!member || subscriptions.length === 0) {
      skippedNoMember++;
      continue;
    }
    const byList = perListByMember.get(memberId);
    const globalTimestamp = globalByMember.get(memberId);
    let changed = false;
    const updatedSubscriptions = subscriptions.map(subscription => {
      if (subscription.subscribed || Number.isFinite(subscription.unsubscribedAt)) {
        return subscription;
      }
      const unsubscribedAt = byList?.get(subscription.id) ?? globalTimestamp;
      if (Number.isFinite(unsubscribedAt)) {
        changed = true;
        return { ...subscription, unsubscribedAt };
      }
      return subscription;
    });
    if (changed) {
      await members.updateOne({ _id: new ObjectId(memberId) }, { $set: { "mail.subscriptions": updatedSubscriptions } });
      updated++;
    } else {
      skippedNoChange++;
    }
  }

  debugLog(`Completed: updated=${updated}, skippedNoMember=${skippedNoMember}, skippedNoChange=${skippedNoChange}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; subscription unsubscribedAt backfill is not reversible");
}
