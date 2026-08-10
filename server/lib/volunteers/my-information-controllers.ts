import { Request, Response } from "express";
import { uniq } from "es-toolkit/compat";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";
import {
  VolunteerAssignment,
  VolunteerAssignmentScope,
  VolunteerAssignmentStatus,
  VolunteerMyInformation,
  VolunteerParish,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { volunteerMyInformation } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-my-information";
import { memberFullName } from "../../../projects/ngx-ramblers/src/app/functions/member-names";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { volunteerAssignment } from "../mongo/models/volunteer-assignment";
import { volunteerParish } from "../mongo/models/volunteer-parish";
import { externalRecipient } from "../mongo/models/external-recipient";
import { member } from "../mongo/models/member";
import * as transforms from "../mongo/controllers/transforms";

const errorDebugLog = createErrorDebugLog("volunteer-my-information");

function authenticatedMemberId(req: Request): string {
  return (req.user as Partial<MemberCookie>)?.memberId ?? "";
}

function emptyInformation(): VolunteerMyInformation {
  return {memberName: "", parishCount: 0, parishes: []};
}

function toSupporterIdentity(document: any): VolunteerSupporterIdentity {
  const resolved = transforms.toObjectWithId(document) as Member;
  return {id: resolved.id, firstName: resolved.firstName, lastName: resolved.lastName, displayName: resolved.displayName, email: resolved.email};
}

export async function myInformation(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.query.groupCode?.toString() ?? "";
    const memberId = authenticatedMemberId(req);
    if (!groupCode || !memberId || memberId === "api") {
      res.status(200).json({action: ApiAction.QUERY, response: emptyInformation()});
    } else {
      const [parishDocuments, assignmentDocuments] = await Promise.all([
        volunteerParish.find({groupCode}).sort({parishName: 1}).exec(),
        volunteerAssignment.find({
          groupCode,
          status: VolunteerAssignmentStatus.ACTIVE,
          $or: [{scope: VolunteerAssignmentScope.PARISH}, {scope: {$exists: false}}]
        }).exec()
      ]);
      const parishes = parishDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerParish[];
      const assignments = assignmentDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerAssignment[];
      const myParishCodes = uniq(assignments
        .filter(assignment => assignment.supporterId === memberId && !!assignment.parishCode)
        .map(assignment => assignment.parishCode));
      const counterpartSupporterIds = uniq(assignments
        .filter(assignment => myParishCodes.includes(assignment.parishCode) && !!assignment.supporterId && assignment.supporterId !== memberId)
        .map(assignment => assignment.supporterId));
      const [memberDocument, counterpartDocuments, contactDocuments] = await Promise.all([
        member.findById(memberId).exec(),
        counterpartSupporterIds.length > 0 ? member.find({_id: {$in: counterpartSupporterIds}}).exec() : Promise.resolve([]),
        myParishCodes.length > 0 ? externalRecipient.find({parishCodes: {$in: myParishCodes}}).exec() : Promise.resolve([])
      ]);
      const members = counterpartDocuments.map(toSupporterIdentity);
      const contacts = contactDocuments.map(document => transforms.toObjectWithId(document)) as ExternalRecipient[];
      const resolvedMember = memberDocument ? transforms.toObjectWithId(memberDocument) as Member : null;
      const response = volunteerMyInformation({
        memberId,
        memberName: resolvedMember ? memberFullName(resolvedMember) : "",
        assignments,
        parishes,
        members,
        contacts
      });
      res.status(200).json({action: ApiAction.QUERY, response});
    }
  } catch (error) {
    errorDebugLog("myInformation failed", error);
    res.status(500).json({error: "Failed to load your volunteer information", detail: transforms.parseError(error)});
  }
}
