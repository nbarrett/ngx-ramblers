import expect from "expect";
import { describe, it } from "mocha";
import { EventSource, InputSource } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventType } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { EventPopulation } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { dateTimeFromIso } from "../../shared/dates";
import { LocalWalkStatus } from "../models/walk-admin.model";
import {
  bucketWalksForStats,
  classifyLocalWalk,
  classifyWalksManagerWalk,
  mergeWalksByIdentity,
  walksManagerCachedWalk
} from "./classify-local-walk";

const NOW = dateTimeFromIso("2026-01-01T12:00:00.000Z").toMillis();

function walk(overrides: {
  groupEvent?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  events?: {eventType: EventType; date: number}[];
  source?: EventSource;
  _id?: string;
} = {}) {
  return {
    _id: overrides._id,
    groupEvent: {
      title: "Exlade Street, Checkendon, Goring Heath",
      start_date_time: "2025-01-04T10:00:00.000Z",
      status: "confirmed",
      ...(overrides.groupEvent || {})
    },
    fields: {
      contactDetails: {},
      ...(overrides.fields || {})
    },
    events: overrides.events || [],
    source: overrides.source
  };
}

describe("walksManagerCachedWalk", () => {
  it("recognises a Walks Manager cache walk from source or input source", () => {
    expect(walksManagerCachedWalk(walk({source: EventSource.WALKS_MANAGER}))).toEqual(true);
    expect(walksManagerCachedWalk(walk({fields: {inputSource: InputSource.WALKS_MANAGER_CACHE}}))).toEqual(true);
  });

  it("does not treat a locally created walk as Walks Manager cache", () => {
    expect(walksManagerCachedWalk(walk({
      source: EventSource.LOCAL,
      fields: {inputSource: InputSource.MANUALLY_CREATED}
    }))).toEqual(false);
  });
});

describe("classifyLocalWalk", () => {
  it("treats a completed local walk with a title as a led walk even when no member is linked", () => {
    expect(classifyLocalWalk(walk(), NOW)).toEqual(LocalWalkStatus.MORNING);
  });

  it("treats Walks Manager cache walks as filled even when the leader was never published", () => {
    expect(classifyLocalWalk(walk({
      source: EventSource.WALKS_MANAGER,
      fields: {inputSource: InputSource.WALKS_MANAGER_CACHE, contactDetails: {memberId: null, displayName: ""}}
    }), NOW)).toEqual(LocalWalkStatus.MORNING);
  });

  it("does not treat a Walks Manager cache afternoon walk without a published leader as unfilled", () => {
    expect(classifyLocalWalk(walk({
      source: EventSource.WALKS_MANAGER,
      fields: {inputSource: InputSource.WALKS_MANAGER_CACHE},
      groupEvent: {start_date_time: "2025-01-04T16:00:00.000Z"}
    }), NOW)).toEqual(LocalWalkStatus.EVENING);
  });

  it("treats a completed titled walk with a local member as a morning walk", () => {
    expect(classifyLocalWalk(walk({
      fields: {contactDetails: {memberId: "member-1", displayName: "Kerry Example"}}
    }), NOW)).toEqual(LocalWalkStatus.MORNING);
  });

  it("treats a completed titled afternoon walk with a local member as an evening walk", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {start_date_time: "2025-01-04T16:00:00.000Z"},
      fields: {contactDetails: {memberId: "member-1"}}
    }), NOW)).toEqual(LocalWalkStatus.EVENING);
  });

  it("treats a past empty title as an unfilled slot", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {title: ""}
    }), NOW)).toEqual(LocalWalkStatus.UNFILLED);
  });

  it("treats a past slot still awaiting a leader as unfilled", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {title: ""},
      events: [{eventType: EventType.AWAITING_LEADER, date: 1}]
    }), NOW)).toEqual(LocalWalkStatus.UNFILLED);
  });

  it("treats a past titled local slot still awaiting a leader as unfilled", () => {
    expect(classifyLocalWalk(walk({
      events: [{eventType: EventType.AWAITING_LEADER, date: 1}]
    }), NOW)).toEqual(LocalWalkStatus.UNFILLED);
  });

  it("does not treat a Walks Manager cache walk as unfilled just because it has no leader event", () => {
    expect(classifyLocalWalk(walk({
      source: EventSource.WALKS_MANAGER,
      fields: {inputSource: InputSource.WALKS_MANAGER_CACHE},
      events: [{eventType: EventType.AWAITING_LEADER, date: 1}]
    }), NOW)).toEqual(LocalWalkStatus.MORNING);
  });

  it("does not treat a future empty slot as unfilled", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {
        title: "",
        start_date_time: "2026-03-01T10:00:00.000Z"
      },
      events: [{eventType: EventType.AWAITING_LEADER, date: 1}]
    }), NOW)).toEqual(LocalWalkStatus.MORNING);
  });

  it("classifies cancelled walks from status or title", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {status: "cancelled"}
    }), NOW)).toEqual(LocalWalkStatus.CANCELLED);
    expect(classifyLocalWalk(walk({
      groupEvent: {title: "Walk cancelled - ice"}
    }), NOW)).toEqual(LocalWalkStatus.CANCELLED);
  });

  it("classifies walks with a deleted event as deleted", () => {
    expect(classifyLocalWalk(walk({
      events: [{eventType: EventType.DELETED, date: 2}]
    }), NOW)).toEqual(LocalWalkStatus.DELETED);
  });

  it("treats a walk with no start date as unfilled", () => {
    expect(classifyLocalWalk(walk({
      groupEvent: {start_date_time: null}
    }), NOW)).toEqual(LocalWalkStatus.UNFILLED);
  });
});

describe("classifyWalksManagerWalk", () => {

  it("does not treat an unpublished Walks Manager walk as an unfilled local slot", () => {
    expect(classifyWalksManagerWalk(walk({
      source: EventSource.WALKS_MANAGER,
      fields: {inputSource: InputSource.WALKS_MANAGER_CACHE},
      groupEvent: {title: "", start_date_time: "2025-01-04T10:00:00.000Z"}
    }))).toEqual(LocalWalkStatus.MORNING);
  });

  it("classifies evening Walks Manager walks by start time", () => {
    expect(classifyWalksManagerWalk(walk({
      groupEvent: {start_date_time: "2025-01-04T16:00:00.000Z"}
    }))).toEqual(LocalWalkStatus.EVENING);
  });

  it("classifies cancelled Walks Manager walks from status or title", () => {
    expect(classifyWalksManagerWalk(walk({
      groupEvent: {status: "cancelled"}
    }))).toEqual(LocalWalkStatus.CANCELLED);
    expect(classifyWalksManagerWalk(walk({
      groupEvent: {title: "Walk cancelled - ice"}
    }))).toEqual(LocalWalkStatus.CANCELLED);
  });
});

describe("bucketWalksForStats", () => {

  it("keeps local empty past slots unfilled and Walks Manager cache walks as led walks", () => {
    const localEmpty = walk({
      source: EventSource.LOCAL,
      fields: {inputSource: InputSource.MANUALLY_CREATED},
      groupEvent: {title: ""}
    });
    const wmCache = walk({
      source: EventSource.WALKS_MANAGER,
      fields: {inputSource: InputSource.WALKS_MANAGER_CACHE},
      groupEvent: {title: "", start_date_time: "2025-01-04T10:00:00.000Z"}
    });
    const localBuckets = bucketWalksForStats([localEmpty, wmCache], NOW, EventPopulation.LOCAL);
    expect(localBuckets.unfilled).toEqual([localEmpty]);
    expect(localBuckets.morning).toEqual([wmCache]);
    const wmBuckets = bucketWalksForStats([localEmpty, wmCache], NOW, EventPopulation.WALKS_MANAGER);
    expect(wmBuckets.unfilled).toEqual([]);
    expect(wmBuckets.morning.length).toEqual(2);
  });
});

describe("mergeWalksByIdentity", () => {

  it("lets the Walks Manager copy replace a cached walk with the same id and keeps unmatched cache walks", () => {
    const cached = walk({_id: "local-1", groupEvent: {id: "wm-1", title: "Cached", distance_miles: 4}});
    const other = walk({_id: "local-2", groupEvent: {id: "wm-2", title: "Only in cache", distance_miles: 6}});
    const remote = walk({groupEvent: {id: "wm-1", title: "From Walks Manager", distance_miles: 8}});
    const merged = mergeWalksByIdentity([cached, other], [remote]);
    expect(merged.map(item => item.groupEvent.title).sort()).toEqual(["From Walks Manager", "Only in cache"]);
    expect(merged.find(item => item.groupEvent.id === "wm-1").groupEvent.distance_miles).toEqual(8);
  });
});
