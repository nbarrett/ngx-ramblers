import expect from "expect";
import { describe, it } from "mocha";
import { pathSuffixFor } from "./release-paths";

describe("release note paths", () => {
  const day = "2026-09-05";

  it("always gives a note for an issue its own issue suffix, even when it is the only note that day", () => {
    const only = {date: day, issueNumber: "151"};
    expect(pathSuffixFor(only, [only])).toEqual("-issue-151");
  });

  it("gives every issue on a busy day its own suffix", () => {
    const groups = [{date: day, issueNumber: "151"}, {date: day, issueNumber: "385"}];
    expect(groups.map(group => pathSuffixFor(group, groups))).toEqual(["-issue-151", "-issue-385"]);
  });

  it("files commits with no issue under -other when the day has issue notes, and under the bare date otherwise", () => {
    const unassigned = {date: day, issueNumber: null};
    expect(pathSuffixFor(unassigned, [unassigned, {date: day, issueNumber: "151"}])).toEqual("-other");
    expect(pathSuffixFor(unassigned, [unassigned])).toEqual("");
  });
});
