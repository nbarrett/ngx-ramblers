import { describe, expect, it } from "vitest";
import { eventMatchesTagCriteria, tagCriteriaClauses } from "./event-tag-filter";
import { EventField } from "../../models/walk.model";

describe("tagCriteriaClauses", () => {
  it("returns no clauses when neither filter is set", () => {
    expect(tagCriteriaClauses()).toEqual([]);
    expect(tagCriteriaClauses([], [])).toEqual([]);
    expect(tagCriteriaClauses(undefined, undefined)).toEqual([]);
  });

  it("returns a $in clause for tagsAny only", () => {
    expect(tagCriteriaClauses([1, 2])).toEqual([{[EventField.TAGS]: {$in: [1, 2]}}]);
  });

  it("returns a $nin clause for tagsExclude only", () => {
    expect(tagCriteriaClauses([], [3])).toEqual([{[EventField.TAGS]: {$nin: [3]}}]);
  });

  it("returns both clauses when both are set", () => {
    expect(tagCriteriaClauses([1], [9])).toEqual([
      {[EventField.TAGS]: {$in: [1]}},
      {[EventField.TAGS]: {$nin: [9]}}
    ]);
  });
});

describe("eventMatchesTagCriteria", () => {
  it("matches everything when neither filter is set", () => {
    expect(eventMatchesTagCriteria(undefined)).toBe(true);
    expect(eventMatchesTagCriteria([])).toBe(true);
    expect(eventMatchesTagCriteria([1, 2])).toBe(true);
  });

  describe("tagsAny", () => {
    it("rejects untagged events", () => {
      expect(eventMatchesTagCriteria(undefined, [1])).toBe(false);
      expect(eventMatchesTagCriteria([], [1])).toBe(false);
    });

    it("accepts events sharing at least one required tag", () => {
      expect(eventMatchesTagCriteria([1, 2], [2])).toBe(true);
      expect(eventMatchesTagCriteria([1], [1, 2])).toBe(true);
    });

    it("rejects events sharing no required tag", () => {
      expect(eventMatchesTagCriteria([1, 2], [3])).toBe(false);
    });
  });

  describe("tagsExclude", () => {
    it("accepts untagged events (lenient)", () => {
      expect(eventMatchesTagCriteria(undefined, undefined, [1])).toBe(true);
      expect(eventMatchesTagCriteria([], undefined, [1])).toBe(true);
    });

    it("accepts events that don't share any excluded tag", () => {
      expect(eventMatchesTagCriteria([2, 3], undefined, [1])).toBe(true);
    });

    it("rejects events sharing any excluded tag", () => {
      expect(eventMatchesTagCriteria([1, 2], undefined, [1])).toBe(false);
      expect(eventMatchesTagCriteria([2], undefined, [2, 5])).toBe(false);
    });
  });

  describe("both filters", () => {
    it("accepts an event with a required tag and none of the excluded tags", () => {
      expect(eventMatchesTagCriteria([1], [1], [9])).toBe(true);
    });

    it("rejects an event with an excluded tag even though it has a required tag", () => {
      expect(eventMatchesTagCriteria([1, 9], [1], [9])).toBe(false);
    });

    it("rejects an event that has none of the required tags", () => {
      expect(eventMatchesTagCriteria([2], [1], [9])).toBe(false);
    });
  });
});
