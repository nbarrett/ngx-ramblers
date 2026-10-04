import {EventField, GroupEventField} from "../models/walk.model";
import {groupEventIdsCriteria, walkLeaderIdsCriteria} from "./group-event-id-criteria";

describe("groupEventIdsCriteria", () => {
  it("queries a numeric Ramblers ID without treating it as a Mongo ID", () => {
    expect(groupEventIdsCriteria(["100480509"])).toEqual({
      $or: [
        {"groupEvent.id": {$in: ["100480509"]}},
        {"fields.migratedFromId": {$in: ["100480509"]}}
      ]
    });
  });

  it("supports Mongo and external event IDs together", () => {
    const mongoId = "69d20ae66197cce7c5cd2f3e";
    expect(groupEventIdsCriteria([mongoId, "100480509"])).toEqual({
      $or: [
        {_id: {$in: [mongoId]}},
        {"groupEvent.id": {$in: [mongoId, "100480509"]}},
        {"fields.migratedFromId": {$in: [mongoId, "100480509"]}}
      ]
    });
  });
});


describe("walkLeaderIdsCriteria", () => {
  it("matches either stored member IDs or external contact IDs and drops missing identifiers", () => {
    expect(walkLeaderIdsCriteria(["member-example", null, "contact-example"])).toEqual({
      $or: [
        {[EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: ["member-example", "contact-example"]}},
        {[GroupEventField.WALK_LEADER_ID]: {$in: ["member-example", "contact-example"]}}
      ]
    });
  });
});
