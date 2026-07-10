import { InboxRoleVisibility } from "../../../projects/ngx-ramblers/src/app/models/system.model";

export function specialVisibilityGrants(entry: InboxRoleVisibility | undefined, assignedRoleTypes: string[]): boolean {
  return entry?.inboxVisibleToAllRoles === true
    || (entry?.inboxVisibleToRoleTypes ?? []).some(roleType => assignedRoleTypes.includes(roleType));
}
