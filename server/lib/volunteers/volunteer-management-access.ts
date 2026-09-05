import { NextFunction, Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { coordinatorGroupCodes, scopeAllowsRightsOfWayGroup, volunteerAdminAllowed } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-management";
import { VolunteerAccessScope, VolunteerAssignment, VolunteerAssignmentStatus, VolunteerRoleType } from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { volunteerAssignment } from "../mongo/models/volunteer-assignment";
import { volunteerParish } from "../mongo/models/volunteer-parish";
import * as transforms from "../mongo/controllers/transforms";

export function requireVolunteerAdmin(req: Request, res: Response, next: NextFunction): void {
  const authenticatedMember = req.user as Partial<MemberCookie>;
  if (volunteerAdminAllowed(authenticatedMember)) {
    next();
  } else {
    res.status(403).json({error: "Volunteer admin permission required"});
  }
}

const ALL_GROUPS: VolunteerAccessScope = {allGroups: true, rightsOfWayGroupCodes: []};

export async function volunteerAccessScopeFor(authenticatedMember: Partial<MemberCookie>): Promise<VolunteerAccessScope> {
  if (volunteerAdminAllowed(authenticatedMember)) {
    return ALL_GROUPS;
  } else if (authenticatedMember?.memberId) {
    const documents = await volunteerAssignment.find({supporterId: authenticatedMember.memberId, roleType: VolunteerRoleType.GROUP_COORDINATOR, status: VolunteerAssignmentStatus.ACTIVE}).exec();
    const assignments = documents.map(document => transforms.toObjectWithId(document)) as VolunteerAssignment[];
    return {allGroups: false, rightsOfWayGroupCodes: coordinatorGroupCodes(assignments, authenticatedMember.memberId)};
  } else {
    return {allGroups: false, rightsOfWayGroupCodes: []};
  }
}

export function volunteerScopeOf(res: Response): VolunteerAccessScope {
  return (res.locals.volunteerScope as VolunteerAccessScope) || ALL_GROUPS;
}

export async function requireVolunteerAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const scope = await volunteerAccessScopeFor(req.user as Partial<MemberCookie>);
  if (scope.allGroups || scope.rightsOfWayGroupCodes.length > 0) {
    res.locals.volunteerScope = scope;
    next();
  } else {
    res.status(403).json({error: "Volunteer admin permission or a group coordinator role is required"});
  }
}

export async function access(req: Request, res: Response): Promise<void> {
  res.status(200).json({action: ApiAction.QUERY, response: await volunteerAccessScopeFor(req.user as Partial<MemberCookie>)});
}

export async function parishInScope(res: Response, groupCode: string, parishCode: string | null | undefined): Promise<boolean> {
  const scope = volunteerScopeOf(res);
  if (scope.allGroups) {
    return true;
  } else if (!parishCode) {
    return false;
  } else {
    const parish = await volunteerParish.findOne({groupCode, parishCode}).exec();
    return !!parish && scopeAllowsRightsOfWayGroup(scope, parish.get("rightsOfWayGroupCode"));
  }
}

export async function assignmentInScope(res: Response, assignment: Partial<VolunteerAssignment> | null | undefined): Promise<boolean> {
  const scope = volunteerScopeOf(res);
  if (scope.allGroups) {
    return true;
  } else if (!assignment) {
    return false;
  } else if (assignment.parishCode) {
    return parishInScope(res, assignment.groupCode, assignment.parishCode);
  } else {
    return scopeAllowsRightsOfWayGroup(scope, assignment.rightsOfWayGroupCode);
  }
}
