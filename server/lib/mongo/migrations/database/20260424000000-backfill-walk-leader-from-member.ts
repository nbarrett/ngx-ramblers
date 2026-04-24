import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("backfill-walk-leader-from-member");
debugLog.enabled = true;

interface Contact {
  is_overridden: boolean;
  id: string | null;
  name: string | null;
  telephone: string | null;
  has_email: boolean;
  email_form?: string | null;
}

function expectedWalkLeaderFromMember(member: {
  _id: ObjectId;
  displayName?: string | null;
  mobileNumber?: string | null;
  landlineTelephone?: string | null;
  email?: string | null;
}): Contact {
  return {
    is_overridden: false,
    id: member._id.toString(),
    name: member.displayName ?? null,
    telephone: member.mobileNumber || member.landlineTelephone || null,
    has_email: !!member.email
  };
}

function walkLeaderMatches(current: Contact | null | undefined, expected: Contact): boolean {
  if (!current) {
    return false;
  }
  return current.is_overridden === expected.is_overridden
    && current.id === expected.id
    && current.name === expected.name
    && (current.telephone ?? null) === expected.telephone
    && current.has_email === expected.has_email;
}

export async function up(db: Db, client: MongoClient) {
  const walks = db.collection("extendedgroupevents");
  const members = db.collection("members");

  const criteria = {
    "fields.inputSource": "manually-created",
    "fields.contactDetails.memberId": { $exists: true, $ne: null }
  };

  const candidateCount = await walks.countDocuments(criteria);
  debugLog(`Found ${candidateCount} manually-created walks with a contactDetails.memberId`);

  let processed = 0;
  let updated = 0;
  let alreadyCorrect = 0;
  let skippedNoMember = 0;
  let skippedInvalidMemberId = 0;

  const cursor = walks.find(criteria, { projection: { "groupEvent.walk_leader": 1, "fields.contactDetails.memberId": 1 } });
  while (await cursor.hasNext()) {
    const walk = await cursor.next();
    if (!walk) {
      break;
    }
    processed++;

    const memberIdString: string | null = walk.fields?.contactDetails?.memberId ?? null;
    if (!memberIdString || !ObjectId.isValid(memberIdString)) {
      skippedInvalidMemberId++;
      continue;
    }

    const member = await members.findOne(
      { _id: new ObjectId(memberIdString) },
      { projection: { displayName: 1, mobileNumber: 1, landlineTelephone: 1, email: 1 } }
    );
    if (!member) {
      skippedNoMember++;
      debugLog(`Walk ${walk._id}: no member found for memberId=${memberIdString}; skipping`);
      continue;
    }

    const expected = expectedWalkLeaderFromMember(member as any);
    const current: Contact | null | undefined = walk.groupEvent?.walk_leader;
    if (walkLeaderMatches(current, expected)) {
      alreadyCorrect++;
      continue;
    }

    await walks.updateOne(
      { _id: walk._id },
      { $set: { "groupEvent.walk_leader": expected } }
    );
    updated++;
    debugLog(`Walk ${walk._id}: walk_leader updated from ${JSON.stringify(current ?? null)} to ${JSON.stringify(expected)}`);
  }

  debugLog(`Completed: processed=${processed}, updated=${updated}, alreadyCorrect=${alreadyCorrect}, skippedNoMember=${skippedNoMember}, skippedInvalidMemberId=${skippedInvalidMemberId}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; walk_leader backfill is not reversible");
}
