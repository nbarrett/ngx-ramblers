import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNow } from "../../shared/dates";
import { DeletedMember } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { DeletionResponse } from "../../../../projects/ngx-ramblers/src/app/models/mongo-models";
import { member as memberModel } from "../models/member";
import { deletedMember as deletedMemberModel } from "../models/deleted-member";
import { mailListAudit as mailListAuditModel } from "../models/mail-list-audit";

const debugLog = debug(envConfig.logNamespace("member-bulk-delete"));

export interface BulkDeleteMembersResult {
  deletionResponses: DeletionResponse[];
  deletedMemberRows: number;
  auditRowsDeleted: number;
  orphanRowsDeleted: number;
}

export async function bulkDeleteMembersCascade(memberIds: string[], deletedBy: string): Promise<BulkDeleteMembersResult> {
  if (!memberIds?.length) {
    return {deletionResponses: [], deletedMemberRows: 0, auditRowsDeleted: 0, orphanRowsDeleted: 0};
  }
  const existing = await memberModel.find({_id: {$in: memberIds}}).lean();
  const existingById = new Map(existing.map((doc: any) => [doc._id.toString(), doc]));
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
