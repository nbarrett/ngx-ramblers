import expect from "expect";
import {describe, it} from "mocha";
import type {ConventionalCommit} from "./models";
import {assertEveryCommitGrouped, groupCommitsByDateAndIssue} from "./release-grouping";

function commit(hash: string, date: string, issue: string | null): ConventionalCommit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    date,
    type: "fix",
    scope: null,
    subject: `Change ${hash}`,
    body: "",
    footer: "",
    issueReferences: issue ? [{action: null, issue, raw: `#${issue}`}] : [],
    breakingChange: false
  };
}

describe("release-note grouping", () => {
  it("combines commits only when their date and issue both match", () => {
    const commits = [commit("newer", "2026-09-20", "20"), commit("same-day", "2026-09-20", "20"), commit("older", "2026-09-16", "20")];
    const groups = groupCommitsByDateAndIssue(commits);
    expect(groups.map(group => ({date: group.date, issue: group.issueNumber, hashes: group.commits.map(item => item.hash)}))).toEqual([
      {date: "2026-09-20", issue: "20", hashes: ["newer", "same-day"]},
      {date: "2026-09-16", issue: "20", hashes: ["older"]}
    ]);
    assertEveryCommitGrouped(commits, groups);
  });

  it("fails when any commit is absent from the release-note groups", () => {
    const commits = [commit("first", "2026-09-20", "20"), commit("second", "2026-09-20", "20")];
    const groups = groupCommitsByDateAndIssue(commits).map(group => ({...group, commits: group.commits.slice(0, 1)}));
    expect(() => assertEveryCommitGrouped(commits, groups)).toThrow(/1 missing/);
  });
});
