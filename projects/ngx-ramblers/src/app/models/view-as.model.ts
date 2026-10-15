export enum ViewAsMode {
  PERSON = "person",
  ROLE = "role"
}

export interface ViewAsSelection {
  actorId: string;
  memberSlug: string;
  roleType: string | null;
}
