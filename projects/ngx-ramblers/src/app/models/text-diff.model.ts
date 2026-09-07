export enum DiffSegmentKind {
  SAME = "same",
  REMOVED = "removed",
  ADDED = "added"
}

export interface DiffSegment {
  kind: DiffSegmentKind;
  text: string;
}

export enum DescriptionTidyView {
  PROPOSED = "Proposed",
  CHANGES = "Changes",
  ORIGINAL = "Original"
}
