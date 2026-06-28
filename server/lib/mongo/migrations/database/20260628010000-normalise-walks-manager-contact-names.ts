import { Db, ObjectId } from "mongodb";
import { memberFullName, trimmedNamePart } from "../../../../../projects/ngx-ramblers/src/app/functions/member-names";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("normalise-walks-manager-contact-names");

type MemberContactDocument = {
  firstName?: string | null;
  title?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  contactId?: string | null;
};

type EventContactDocument = {
  groupEvent?: {
    title?: string | null;
  };
  fields?: {
    contactDetails?: {
      memberId?: string | null;
      contactId?: string | null;
    };
    publishing?: {
      ramblers?: {
        contactName?: string | null;
      };
    };
  };
};

export async function up(db: Db) {
  const members = db.collection<MemberContactDocument>("members");
  const events = db.collection<EventContactDocument>("extendedgroupevents");

  let membersProcessed = 0;
  let membersUpdated = 0;
  let membersAlreadyCorrect = 0;
  let membersSkippedNoFullName = 0;

  const memberCursor = members.find({
    contactId: {$exists: true, $nin: [null, ""]}
  }, {
    projection: {firstName: 1, lastName: 1, title: 1, displayName: 1, contactId: 1}
  });

  for await (const member of memberCursor) {
    membersProcessed++;
    const contactName = trimmedNamePart(member.contactId);
    const fullName = memberFullName(member);
    if (!fullName) {
      membersSkippedNoFullName++;
    } else if (contactName === fullName) {
      membersAlreadyCorrect++;
    } else {
      await members.updateOne({_id: member._id}, {$set: {contactId: fullName}});
      membersUpdated++;
      debugLog("Member %s contactId normalised from %s to %s", member._id, contactName, fullName);
    }
  }

  let eventsProcessed = 0;
  let eventsUpdated = 0;
  let eventsAlreadyCorrect = 0;
  let eventsSkippedInvalidMemberId = 0;
  let eventsSkippedNoMember = 0;
  let eventsSkippedNoFullName = 0;

  const eventCursor = events.find({
    "fields.publishing.ramblers.contactName": {$exists: true, $nin: [null, ""]},
    "fields.contactDetails.memberId": {$exists: true, $nin: [null, ""]}
  }, {
    projection: {
      "groupEvent.title": 1,
      "fields.contactDetails.memberId": 1,
      "fields.contactDetails.contactId": 1,
      "fields.publishing.ramblers.contactName": 1
    }
  });

  for await (const event of eventCursor) {
    eventsProcessed++;
    const memberId = trimmedNamePart(event.fields?.contactDetails?.memberId);
    if (!ObjectId.isValid(memberId)) {
      eventsSkippedInvalidMemberId++;
      continue;
    }

    const member = await members.findOne(
      {_id: new ObjectId(memberId)},
      {projection: {firstName: 1, lastName: 1, title: 1, displayName: 1}}
    );
    if (!member) {
      eventsSkippedNoMember++;
      continue;
    }

    const fullName = memberFullName(member);
    if (!fullName) {
      eventsSkippedNoFullName++;
      continue;
    }

    const eventContactName = trimmedNamePart(event.fields?.publishing?.ramblers?.contactName);
    const contactDetailsContactId = trimmedNamePart(event.fields?.contactDetails?.contactId);
    if (eventContactName === fullName && (!contactDetailsContactId || contactDetailsContactId === fullName)) {
      eventsAlreadyCorrect++;
      continue;
    }

    await events.updateOne(
      {_id: event._id},
      {
        $set: {
          "fields.publishing.ramblers.contactName": fullName,
          "fields.contactDetails.contactId": fullName
        }
      }
    );
    eventsUpdated++;
    debugLog("Event %s (%s) contact name normalised from %s to %s", event._id, event.groupEvent?.title, eventContactName, fullName);
  }

  debugLog(
    "Members completed: processed=%d updated=%d alreadyCorrect=%d skippedNoFullName=%d",
    membersProcessed, membersUpdated, membersAlreadyCorrect, membersSkippedNoFullName
  );
  debugLog(
    "Events completed: processed=%d updated=%d alreadyCorrect=%d skippedInvalidMemberId=%d skippedNoMember=%d skippedNoFullName=%d",
    eventsProcessed, eventsUpdated, eventsAlreadyCorrect, eventsSkippedInvalidMemberId, eventsSkippedNoMember, eventsSkippedNoFullName
  );
}

export async function down() {
  debugLog("Down is a no-op: previous abbreviated and legacy contact names cannot be reconstructed safely");
}
