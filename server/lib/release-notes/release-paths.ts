export interface ReleasePathGroup {
  date: string;
  issueNumber: string | null;
}

export const OTHER_SUFFIX = "-other";

export function issueSuffix(issueNumber: string): string {
  return `-issue-${issueNumber}`;
}

export function pathSuffixFor(group: ReleasePathGroup, groupsOnSameDate: ReleasePathGroup[]): string {
  if (group.issueNumber) {
    return issueSuffix(group.issueNumber);
  } else if (groupsOnSameDate.some(other => !!other.issueNumber)) {
    return OTHER_SUFFIX;
  } else {
    return "";
  }
}
