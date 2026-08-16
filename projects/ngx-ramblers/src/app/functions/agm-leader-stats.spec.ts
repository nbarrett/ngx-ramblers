import { describe, expect, it } from "vitest";
import {
  aggregateLeaderStats,
  asLeaderStats,
  leaderIdentityFromWalk,
  leaderStatsFromWalks,
  UNKNOWN_WALK_LEADER_KEY,
  UNKNOWN_WALK_LEADER_NAME
} from "./agm-leader-stats";
import { LeaderStats } from "../models/group-event.model";

describe("asLeaderStats", () => {
  it("keeps string names and emails", () => {
    expect(asLeaderStats({
      id: "abc",
      name: "  Fiona Hope  ",
      email: " fiona@example.com ",
      walkCount: 4,
      totalMiles: 12.34
    })).toEqual({
      id: "abc",
      name: "Fiona Hope",
      email: "fiona@example.com",
      walkCount: 4,
      totalMiles: 12.3
    });
  });

  it("turns empty walk_leader arrays and other non-strings into blank text", () => {
    expect(asLeaderStats({
      _id: [],
      name: [] as unknown as string,
      email: {address: "x"} as unknown as string,
      walkCount: 2,
      totalMiles: 5
    })).toEqual({
      id: "",
      name: "Unknown",
      email: "",
      walkCount: 2,
      totalMiles: 5
    });
  });
});

describe("aggregateLeaderStats", () => {
  const leader = (overrides: Partial<LeaderStats>): LeaderStats => ({
    id: "id-1",
    name: "Fiona Hope",
    email: "fiona@example.com",
    walkCount: 2,
    totalMiles: 8,
    ...overrides
  });

  it("does not throw when a leader name is an empty array", () => {
    const rows = aggregateLeaderStats([
      leader({name: [] as unknown as string, email: "", id: [] as unknown as string}),
      leader({name: "Tom G", email: "tom@example.com", id: "tom", walkCount: 3, totalMiles: 12})
    ]);
    expect(rows).toEqual([
      {id: "tom", name: "Tom G", email: "tom@example.com", walkCount: 3, totalMiles: 12, rank: 1},
      {id: "unknown", name: "Unknown", email: "", walkCount: 2, totalMiles: 8, rank: 2}
    ]);
  });

  it("merges the same person across years by email or name", () => {
    const rows = aggregateLeaderStats([
      leader({walkCount: 2, totalMiles: 8}),
      leader({id: "other", walkCount: 3, totalMiles: 10.05}),
      leader({id: "tom", name: "Tom G", email: "tom@example.com", walkCount: 1, totalMiles: 4})
    ]);
    expect(rows).toEqual([
      {id: "id-1", name: "Fiona Hope", email: "fiona@example.com", walkCount: 5, totalMiles: 18.1, rank: 1},
      {id: "tom", name: "Tom G", email: "tom@example.com", walkCount: 1, totalMiles: 4, rank: 2}
    ]);
  });

  it("collapses blank and Unknown names into one row", () => {
    const rows = aggregateLeaderStats([
      leader({id: "tel-1", name: "", email: "", walkCount: 1, totalMiles: 4}),
      leader({id: "form-2", name: "Unknown", email: "", walkCount: 1, totalMiles: 5.5}),
      leader({id: "tom", name: "Tom G", email: "tom@example.com", walkCount: 2, totalMiles: 10})
    ]);
    expect(rows).toEqual([
      {id: "tom", name: "Tom G", email: "tom@example.com", walkCount: 2, totalMiles: 10, rank: 1},
      {id: "unknown", name: "Unknown", email: "", walkCount: 2, totalMiles: 9.5, rank: 2}
    ]);
  });
});

describe("leaderIdentityFromWalk", () => {
  it("puts a Walks Manager cache walk with no published leader in Unknown", () => {
    expect(leaderIdentityFromWalk({
      fields: {contactDetails: {memberId: null, displayName: ""}, inputSource: "walks-manager-cache"},
      groupEvent: {walk_leader: [], distance_miles: 6}
    })).toEqual({id: UNKNOWN_WALK_LEADER_KEY, name: UNKNOWN_WALK_LEADER_NAME, email: ""});
  });

  it("uses the local member when one is linked", () => {
    expect(leaderIdentityFromWalk({
      fields: {contactDetails: {memberId: "member-1", displayName: "Kerry Example", email: "kerry@example.com"}},
      groupEvent: {walk_leader: {name: "Kerry Example"}}
    })).toEqual({id: "kerry@example.com", name: "Kerry Example", email: "kerry@example.com"});
  });
});

describe("leaderStatsFromWalks", () => {
  it("groups unpublished Walks Manager leaders as one Unknown row", () => {
    const rows = leaderStatsFromWalks([
      {fields: {contactDetails: {displayName: ""}}, groupEvent: {walk_leader: [], distance_miles: 6}},
      {fields: {contactDetails: {displayName: ""}}, groupEvent: {walk_leader: [], distance_miles: 4.5}},
      {fields: {contactDetails: {memberId: "tom", displayName: "Tom G", email: "tom@example.com"}}, groupEvent: {distance_miles: 8}}
    ]);
    expect(rows).toEqual([
      {id: UNKNOWN_WALK_LEADER_KEY, name: UNKNOWN_WALK_LEADER_NAME, email: "", walkCount: 2, totalMiles: 10.5},
      {id: "tom@example.com", name: "Tom G", email: "tom@example.com", walkCount: 1, totalMiles: 8}
    ]);
  });
});
