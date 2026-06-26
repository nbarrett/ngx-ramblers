import debug from "debug";
import { isNumber } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNow } from "../../shared/dates";
import { DeletedMember, Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { DeletionResponse } from "../../../../projects/ngx-ramblers/src/app/models/mongo-models";
import { NumberOrString, PostSendActionsResult, WorkflowAction } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { member as memberModel } from "../models/member";
import { deletedMember as deletedMemberModel } from "../models/deleted-member";
import { mailListAudit as mailListAuditModel } from "../models/mail-list-audit";
import { deleteBrevoContacts } from "../../brevo/contacts/contact-delete";
import { writeBackOptOutsForRemovedMembers } from "../../salesforce/member-consent-writeback";

const debugLog = debug(envConfig.logNamespace("member-bulk-delete"));

export async function applyPostSendActionsToMembers(memberIds: string[], postSendActions: WorkflowAction[], performedBy: string): Promise<PostSendActionsResult> {
  const result: PostSendActionsResult = { disabled: 0, deleted: 0 };
  if (!memberIds?.length || !postSendActions?.length) {
    return result;
  }
  if (postSendActions.includes(WorkflowAction.DISABLE_GROUP_MEMBER)) {
    const toDisable = await memberModel.find({ _id: { $in: memberIds } }).lean();
    const updated = await memberModel.updateMany({ _id: { $in: memberIds } }, { $set: { groupMember: false } });
    result.disabled = updated.modifiedCount || 0;
    debugLog("applyPostSendActions DISABLE_GROUP_MEMBER: cleared groupMember on", result.disabled, "of", memberIds.length, "members");
    await removeFromBrevoAndWriteBackConsent(toDisable as unknown as Member[], performedBy);
  }
  if (postSendActions.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER)) {
    const cascade = await bulkDeleteMembersCascade(memberIds, performedBy);
    result.deleted = cascade.deletionResponses.filter(response => response.deleted).length;
    debugLog("applyPostSendActions BULK_DELETE_GROUP_MEMBER: deleted", result.deleted, "members,", cascade.auditRowsDeleted, "audit rows,", cascade.orphanRowsDeleted, "orphan rows");
  }
  return result;
}

export interface BulkDeleteMembersResult {
  deletionResponses: DeletionResponse[];
  deletedMemberRows: number;
  auditRowsDeleted: number;
  orphanRowsDeleted: number;
}

async function removeFromBrevoAndWriteBackConsent(memberDocs: Member[], performedBy: string): Promise<void> {
  if (!memberDocs?.length) {
    return;
  }
  const members: Member[] = memberDocs.map((doc: any) => ({ ...doc, id: doc.id ?? doc._id?.toString() }));
  const brevoContactIds: NumberOrString[] = members.map(member => member.mail?.id).filter(isNumber);
  if (brevoContactIds.length > 0) {
    try {
      await deleteBrevoContacts(brevoContactIds, performedBy);
      debugLog("removeFromBrevoAndWriteBackConsent: deleted", brevoContactIds.length, "Brevo contacts", brevoContactIds);
    } catch (error: any) {
      debugLog("removeFromBrevoAndWriteBackConsent: Brevo contact deletion failed for", brevoContactIds, error?.message ?? error);
    }
  }
  await writeBackOptOutsForRemovedMembers(members, performedBy);
}

export async function bulkDeleteMembersCascade(memberIds: string[], deletedBy: string): Promise<BulkDeleteMembersResult> {
  if (!memberIds?.length) {
    return {deletionResponses: [], deletedMemberRows: 0, auditRowsDeleted: 0, orphanRowsDeleted: 0};
  }
  const existing = await memberModel.find({_id: {$in: memberIds}}).lean();
  const existingById = new Map(existing.map((doc: any) => [doc._id.toString(), doc]));
  await removeFromBrevoAndWriteBackConsent(existing as unknown as Member[], deletedBy);
  await memberModel.deleteMany({_id: {$in: memberIds}});
  const deletionResponses: DeletionResponse[] = memberIds.map(id => ({id, deleted: existingById.has(id)}));
  const deletedIds = deletionResponses.filter(response => response.deleted).map(response => response.id);
  const deletedAt = dateTimeNow().toMillis();
  const deletedMemberRows: DeletedMember[] = deletedIds.map(id => ({
    deletedAt,
    deletedBy,
    memberId: id,
    membershipNumber: existingById.get(id)?.membershipNumber ?? ""
  }));
  if (deletedMemberRows.length > 0) {
    await deletedMemberModel.insertMany(deletedMemberRows);
  }
  const auditDeleteResult = await mailListAuditModel.deleteMany({memberId: {$in: deletedIds}});
  const validIds: string[] = (await memberModel.distinct("_id")).map((id: any) => id?.toString()).filter(Boolean);
  const orphanResult = await mailListAuditModel.deleteMany({memberId: {$exists: true, $ne: null, $nin: validIds}});
  debugLog("bulkDeleteMembersCascade: deleted", deletedIds.length, "of", memberIds.length, "members,", deletedMemberRows.length, "deletedMember rows,", auditDeleteResult.deletedCount, "mailListAudit rows,", orphanResult.deletedCount, "orphan rows");
  return {
    deletionResponses,
    deletedMemberRows: deletedMemberRows.length,
    auditRowsDeleted: auditDeleteResult.deletedCount || 0,
    orphanRowsDeleted: orphanResult.deletedCount || 0
  };
}
