export interface WalkAccessMode {
  caption: string;
  title: string;
  walkWritable?: boolean;
  initialiseWalkLeader?: boolean;
}

export enum WalkLeadEditAppearance {
  OVERLAY = "overlay",
  ACTION = "action",
  INLINE = "inline"
}

export enum WalkLeadEditAction {
  LEAD = "lead",
  EDIT = "edit"
}

