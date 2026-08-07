import debug from "debug";
import { isBoolean, isNumber, isString, keys } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { memberUpdateAudit } from "../models/member-update-audit";
import { dateTimeNowAsValue } from "../../shared/dates";
import { MemberAction, MemberAuditFieldChange, Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const debugLog = debug(envConfig.logNamespace("member:field-audit"));
debugLog.enabled = false;

const NOT_AUDITED: (keyof Member | string)[] = [
  "id",
  "_id",
  "__v",
  "password",
  "expiredPassword",
  "createdBy",
  "createdDate",
  "updatedBy",
  "updatedDate"
];

export interface MemberFieldChangeContext {
  memberId: string;
  prior?: Member;
  next: Member;
}

function auditableValue(value: any): boolean {
  return value === null || value === undefined || isString(value) || isNumber(value) || isBoolean(value);
}

function asAuditString(value: any): string {
  return value === null || value === undefined || value === "" ? "(none)" : String(value);
}

export function memberFieldChanges(prior: Member | undefined, next: Member): MemberAuditFieldChange[] {
  const fieldNames = Array.from(new Set([...keys(prior ?? {}), ...keys(next ?? {})]))
    .filter(fieldName => !NOT_AUDITED.includes(fieldName))
    .filter(fieldName => auditableValue(next?.[fieldName]) && auditableValue(prior?.[fieldName]));
  return fieldNames
    .filter(fieldName => asAuditString(prior?.[fieldName]) !== asAuditString(next?.[fieldName]))
    .map(fieldName => ({
      fieldName,
      from: asAuditString(prior?.[fieldName]),
      to: asAuditString(next?.[fieldName]),
      resolution: prior ? "Edited" : "Created"
    }));
}

export async function auditMemberFieldChanges(contexts: MemberFieldChangeContext[], actingUser: string): Promise<void> {
  const updateTime = dateTimeNowAsValue();
  const audits = contexts
    .map(context => ({context, fieldChanges: memberFieldChanges(context.prior, context.next)}))
    .filter(item => item.fieldChanges.length > 0)
    .map(item => ({
      updateTime,
      memberMatch: item.context.prior ? MemberAction.found : MemberAction.created,
      memberAction: item.context.prior ? MemberAction.updated : MemberAction.created,
      changes: item.fieldChanges.length,
      fieldChanges: item.fieldChanges,
      memberId: item.context.memberId,
      updatedBy: actingUser,
      updatedDate: updateTime
    }));
  if (audits.length > 0) {
    try {
      await memberUpdateAudit.insertMany(audits);
      debugLog("recorded field changes for", audits.length, "members");
    } catch (error) {
      debugLog("failed to record member field changes:", error);
    }
  }
}
