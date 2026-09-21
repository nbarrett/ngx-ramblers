import {asNumber} from "../../../projects/ngx-ramblers/src/app/functions/numbers";
import {pathSuffixFor} from "./release-paths";
import type {ConventionalCommit, ReleaseGroup} from "./models";

function assignFallbackIssues(commits: ConventionalCommit[]): Map<string, string | null> {
  return commits.reduce<{assignments: Map<string, string | null>; lastIssue: string | null}>((state, commit) => {
    const commitIssue = commit.issueReferences.length > 0 ? commit.issueReferences[0].issue : null;
    const resolvedIssue = commitIssue ?? state.lastIssue;
    state.assignments.set(commit.hash, resolvedIssue);
    return {assignments: state.assignments, lastIssue: commitIssue ?? state.lastIssue};
  }, {assignments: new Map<string, string | null>(), lastIssue: null}).assignments;
}

export function groupCommitsByDateAndIssue(commits: ConventionalCommit[]): ReleaseGroup[] {
  const issueAssignments = assignFallbackIssues(commits);
  const grouped = commits.reduce((groups, commit) => {
    const issueNumber = issueAssignments.get(commit.hash) || null;
    const key = `${commit.date}:${issueNumber || "unassigned"}`;
    const existing = groups.get(key);
    groups.set(key, existing ? {...existing, commits: existing.commits.concat(commit)} : {
      date: commit.date,
      issueNumber,
      commits: [commit],
      pathSuffix: ""
    });
    return groups;
  }, new Map<string, ReleaseGroup>());
  const groupsByDate = [...grouped.values()].reduce((groups, group) => {
    groups.set(group.date, (groups.get(group.date) || []).concat(group));
    return groups;
  }, new Map<string, ReleaseGroup[]>());
  return [...groupsByDate.entries()].flatMap(([, dateGroups]) => {
    const withIssue = dateGroups.filter(group => group.issueNumber).sort((left, right) => asNumber(right.issueNumber) - asNumber(left.issueNumber));
    const withoutIssue = dateGroups.filter(group => !group.issueNumber);
    return withIssue.concat(withoutIssue).map(group => ({...group, pathSuffix: pathSuffixFor(group, dateGroups)}));
  }).sort((left, right) => {
    const dateComparison = right.date.localeCompare(left.date);
    return dateComparison || asNumber(right.issueNumber) - asNumber(left.issueNumber);
  });
}

export function assertEveryCommitGrouped(commits: ConventionalCommit[], groups: ReleaseGroup[]): void {
  const expected = commits.map(commit => commit.hash).sort();
  const grouped = groups.flatMap(group => group.commits.map(commit => commit.hash)).sort();
  if (expected.length !== grouped.length || expected.some((hash, index) => hash !== grouped[index])) {
    const missing = expected.filter(hash => !grouped.includes(hash));
    const duplicated = grouped.filter((hash, index) => grouped.indexOf(hash) !== index);
    throw new Error(`Release-note accounting failed: ${missing.length} missing and ${new Set(duplicated).size} duplicated commits`);
  }
}
