import { Db } from "mongodb";
import {
  abbreviatedWalksManagerContactName,
  memberFullName,
  trimmedNamePart
} from "../../../../../projects/ngx-ramblers/src/app/functions/member-names";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("repair-abbreviated-walks-manager-contact-names");

type MemberContactDocument = {
  firstName?: string | null;
  title?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  contactId?: string | null;
};

export async function up(db: Db) {
  const members = db.collection<MemberContactDocument>("members");
  const membersWithContactName = await members.find({
    contactId: {$exists: true, $nin: [null, ""]}
  }, {
    projection: {firstName: 1, lastName: 1, title: 1, displayName: 1, contactId: 1}
  }).toArray();

  const candidates = membersWithContactName
    .map(member => ({member, contactName: trimmedNamePart(member.contactId), fullName: memberFullName(member)}))
    .filter(candidate => abbreviatedWalksManagerContactName(candidate.contactName));
  const repairs = candidates.filter(candidate => !!candidate.fullName && !abbreviatedWalksManagerContactName(candidate.fullName));

  await Promise.all(repairs.map(repair => members
    .updateOne({_id: repair.member._id}, {$set: {contactId: repair.fullName}})
    .then(() => debugLog("Member %s contactId repaired from %s to %s", repair.member._id, repair.contactName, repair.fullName))));

  debugLog(
    "Completed: processed=%d abbreviated=%d repaired=%d skippedNoUsableFullName=%d",
    membersWithContactName.length, candidates.length, repairs.length, candidates.length - repairs.length
  );
}

export async function down() {
  debugLog("Down is a no-op: repaired contact names cannot be safely reduced back to their abbreviated form");
}
