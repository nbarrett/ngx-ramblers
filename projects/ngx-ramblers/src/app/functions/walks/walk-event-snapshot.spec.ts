import { EventType } from "../../models/walk.model";
import { systemWalkDetailsUpdatedEvent, walkEventDataSnapshot, walkEventSnapshotEvent, walkWithUserChanges } from "./walk-event-snapshot";

describe("walk event snapshots", () => {
  const walk = {
    fields: {
      contactDetails: {
        memberId: "member-1",
        displayName: "Tina F",
        contactId: "Tina Foster",
        email: "tina@example.org",
        phone: "07123456789"
      },
      publishing: {
        ramblers: {publish: true, contactName: "Tina Foster"}
      }
    },
    groupEvent: {title: "Test walk"},
    events: [{eventType: EventType.APPROVED}]
  } as any;

  it("creates a snapshot containing audited walk data but not event history", () => {
    expect(walkEventDataSnapshot(walk)).toEqual({
      fields: {
        contactDetails: walk.fields.contactDetails,
        publishing: walk.fields.publishing
      },
      groupEvent: {title: "Test walk"}
    });
  });

  it("creates a system history event from the shared snapshot", () => {
    expect(systemWalkDetailsUpdatedEvent(walk, 123, "Automatic match")).toEqual({
      data: walkEventDataSnapshot(walk),
      eventType: EventType.WALK_DETAILS_UPDATED,
      date: 123,
      memberId: "system",
      reason: "Automatic match"
    });
  });

  it("creates a baseline event from the shared snapshot", () => {
    expect(walkEventSnapshotEvent(walk, EventType.APPROVED, 122, "system", "Baseline")).toEqual({
      data: walkEventDataSnapshot(walk),
      eventType: EventType.APPROVED,
      date: 122,
      memberId: "system",
      reason: "Baseline"
    });
  });

  it("excludes editor initialisation while retaining user changes", () => {
    const persistedWalk = {
      id: "walk-1",
      fields: {imageConfig: null, milesPerHour: 0, venue: null},
      groupEvent: {title: "Original title"},
      events: []
    } as any;
    const initialisedWalk = {
      ...persistedWalk,
      fields: {
        imageConfig: {source: "NONE", importFrom: {groupCode: "KT01"}},
        milesPerHour: 2.5,
        venue: {postcode: "TN1 1AA", venuePublish: false}
      }
    } as any;
    const editedWalk = {
      ...initialisedWalk,
      groupEvent: {title: "User-edited title"}
    } as any;

    expect(walkWithUserChanges(persistedWalk, initialisedWalk, editedWalk)).toEqual({
      ...persistedWalk,
      groupEvent: {title: "User-edited title"}
    });
  });

  it("retains an editor-initialised field when the user changes it", () => {
    const persistedWalk = {
      id: "walk-1",
      fields: {milesPerHour: 0},
      groupEvent: {title: "Original title"},
      events: []
    } as any;
    const initialisedWalk = {...persistedWalk, fields: {milesPerHour: 2.5}} as any;
    const editedWalk = {...initialisedWalk, fields: {milesPerHour: 3}} as any;

    expect(walkWithUserChanges(persistedWalk, initialisedWalk, editedWalk).fields.milesPerHour).toEqual(3);
  });
});
