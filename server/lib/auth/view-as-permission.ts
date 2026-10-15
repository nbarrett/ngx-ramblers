import { isBoolean, isUndefined } from "es-toolkit/compat";
import { Request } from "express";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { member as memberModel } from "../mongo/models/member";

export function validateViewAsPermissionChange(actor: Partial<MemberCookie> | null, prior: Member | null, next: Member): void {
  if ((!isUndefined(next.viewAsMember) && next.viewAsMember !== null && !isBoolean(next.viewAsMember)) || (!isUndefined(next.memberAdmin) && next.memberAdmin !== null && !isBoolean(next.memberAdmin))) {
    throw Object.assign(new Error("View as permissions must be boolean values"), {status: 403});
  }
  const memberAdminChanges = !isUndefined(next.memberAdmin) && (next.memberAdmin === true) !== (prior?.memberAdmin === true);
  if (memberAdminChanges && !actor?.memberAdmin) {
    throw Object.assign(new Error("Member Admin permission is required to change administrator access"), {status: 403});
  }
  const permissionChanges = !isUndefined(next.viewAsMember) && (next.viewAsMember === true) !== (prior?.viewAsMember === true);
  const activatesExistingGrant = prior?.viewAsMember === true && ((prior.memberAdmin !== true && next.memberAdmin === true) || (prior.revoked === true && next.revoked === false));
  if ((permissionChanges || activatesExistingGrant) && !actor?.memberAdmin) {
    throw Object.assign(new Error("Only a member administrator can change the View as another member permission"), {status: 403});
  }
}

export async function validateViewAsPermissionChanges(req: Request, priorById: Map<string, Member>, members: Member[]): Promise<void> {
  const actorId = (req.user as Partial<MemberCookie>)?.memberId;
  const actor = actorId ? await memberModel.findById(actorId) : null;
  const currentActor = actor ? {memberId: actorId, memberAdmin: actor.memberAdmin === true && actor.revoked !== true} : null;
  members.forEach(next => validateViewAsPermissionChange(currentActor, priorById.get(next.id) ?? null, next));
}
