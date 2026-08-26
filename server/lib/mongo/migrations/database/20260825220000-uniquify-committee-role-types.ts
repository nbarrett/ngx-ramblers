import { Db, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, INBOX_MESSAGES_COLLECTION, INBOX_THREADS_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeMember } from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMessageDirection } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { normaliseEmail } from "../../../../../projects/ngx-ramblers/src/app/functions/strings";
import {
  committeeRolesWithUniqueTypes,
  committeeRoleTypeChanges,
  InboxThreadRoleHint,
  threadMatchesRoleTypeChange
} from "../../../inbox/inbox-role-type-uniquify";

const debugLog = createMigrationLogger("uniquify-committee-role-types");

function messageEmails(message: {from?: {email?: string}; to?: {email?: string}[]; cc?: {email?: string}[]}): string[] {
  return [message.from, ...(message.to ?? []), ...(message.cc ?? [])]
    .map(address => normaliseEmail(address?.email ?? ""))
    .filter(Boolean);
}

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  const roles: CommitteeMember[] = committeeConfig?.value?.roles ?? [];
  if (roles.length === 0) {
    debugLog("No committee roles found — skipping");
  } else {
    const changes = committeeRoleTypeChanges(roles);
    const uniqued = committeeRolesWithUniqueTypes(roles);
    if (changes.length === 0) {
      debugLog("Committee role types are already unique — nothing to do");
    } else {
      const threads = await db.collection(INBOX_THREADS_COLLECTION).find({
        roleType: {$in: changes.map(change => change.from)}
      }).toArray() as unknown as (InboxThreadRoleHint & {_id: ObjectId})[];
      const threadIds = threads.map(thread => thread._id);
      const messages = threadIds.length === 0
        ? []
        : await db.collection(INBOX_MESSAGES_COLLECTION).find({
          threadId: {$in: threadIds.map(id => id.toString())},
          direction: InboxMessageDirection.INBOUND
        }).project({threadId: 1, from: 1, to: 1, cc: 1}).toArray();
      const emailsByThread = messages.reduce<Record<string, string[]>>((map, message) => {
        const threadId = String(message.threadId);
        map[threadId] = (map[threadId] ?? []).concat(messageEmails(message));
        return map;
      }, {});
      const remapped = {count: 0};
      await changes.reduce<Promise<void>>(async (previous, change) => {
        await previous;
        const matchingIds = threads
          .filter(thread => threadMatchesRoleTypeChange(thread, emailsByThread[String(thread._id)] ?? [], change))
          .map(thread => thread._id);
        if (matchingIds.length > 0) {
          const result = await db.collection(INBOX_THREADS_COLLECTION).updateMany(
            {_id: {$in: matchingIds}},
            {$set: {roleType: change.to}}
          );
          remapped.count += result.modifiedCount;
          debugLog("Remapped %d inbox thread(s) from %s to %s", result.modifiedCount, change.from, change.to);
        }
      }, Promise.resolve());
      await configCollection.updateOne(
        {key: ConfigKey.COMMITTEE},
        {$set: {"value.roles": uniqued}}
      );
      debugLog(
        "Uniquified %d committee role type(s) and remapped %d thread(s): %s",
        changes.length,
        remapped.count,
        changes.map(change => `${change.from} -> ${change.to}`).join(", ")
      );
    }
  }
}

export async function down(_db: Db) {
  debugLog("down: no-op — uniquified role types are the committee identity going forward");
}
