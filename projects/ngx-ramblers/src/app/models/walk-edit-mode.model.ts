export interface WalkAccessMode {
  caption: string;
  title: string;
  walkWritable?: boolean;
  initialiseWalkLeader?: boolean;
}

export enum WalkLeadEditAppearance {
  OVERLAY = "overlay",
  ACTION = "action",
  COMPACT = "compact"
}

export enum WalkLeadEditAction {
  LEAD = "lead",
  EDIT = "edit"
}

