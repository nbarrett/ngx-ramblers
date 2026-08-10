import {
  VolunteerAssignment,
  VolunteerAssignmentAuditAction,
  VolunteerAssignmentFieldChange
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { volunteerAssignmentFieldChanges } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-management";
import { volunteerAssignmentAudit } from "../mongo/models/volunteer-assignment-audit";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { dateTimeNowAsValue } from "../shared/dates";

const errorDebugLog = createErrorDebugLog("volunteer-assignment-audit");

export async function recordVolunteerAssignmentAudit(action: VolunteerAssignmentAuditAction, before: Partial<VolunteerAssignment> | null, after: VolunteerAssignment, performedBy: string): Promise<void> {
  try {
    const fieldChanges: VolunteerAssignmentFieldChange[] = volunteerAssignmentFieldChanges(before, after);
    await volunteerAssignmentAudit.create({
      groupCode: after.groupCode,
      assignmentId: after.id,
      parishCode: after.parishCode,
      roleType: after.roleType,
      action,
      fieldChanges,
      performedAt: dateTimeNowAsValue(),
      performedBy
    });
  } catch (error) {
    errorDebugLog("failed to record audit for assignment", after?.id, error);
  }
}

export async function recordVolunteerAssignmentAudits(action: VolunteerAssignmentAuditAction, before: VolunteerAssignment[], after: VolunteerAssignment[], performedBy: string): Promise<void> {
  const beforeById = new Map(before.map(assignment => [assignment.id, assignment]));
  await Promise.all(after.map(assignment => recordVolunteerAssignmentAudit(action, beforeById.get(assignment.id) ?? null, assignment, performedBy)));
}
