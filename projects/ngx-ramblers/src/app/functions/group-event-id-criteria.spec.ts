import {groupEventIdsCriteria} from "./group-event-id-criteria";

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
