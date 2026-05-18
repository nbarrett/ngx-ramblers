import { Request, Response } from "express";
import debug from "debug";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { memberEmailSend, MemberEmailSendDocument } from "../models/member-email-send";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import * as transforms from "./transforms";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("database:member-email-send"));
debugLog.enabled = false;
const errorDebugLog: debug.Debugger = debug("ERROR:" + envConfig.logNamespace("database:member-email-send"));
errorDebugLog.enabled = true;

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const notificationConfigId = isString(req.query?.notificationConfigId) ? req.query.notificationConfigId : null;
    const criteria = notificationConfigId ? { notificationConfigId } : {};
    const docs = await memberEmailSend.find(criteria).sort({ sentAt: -1 }).exec();
    res.status(200).json({
      action: ApiAction.QUERY,
      response: docs.map(doc => transforms.toObjectWithId(doc))
    });
  } catch (error) {
    errorDebugLog("list error:", error);
    res.status(500).json({ message: "member-email-send list failed", error: transforms.parseError(error) });
  }
}

export async function recordMemberEmailSends(input: {
  jobId: string;
  notificationConfigId: string | null;
  subject: string;
  sentBy: string | null;
  entries: { memberId: string; email: string; sentAt: number }[];
}): Promise<void> {
  if (input.entries.length === 0) {
    return;
  }
  const documents: MemberEmailSendDocument[] = input.entries.map(entry => ({
    memberId: entry.memberId,
    email: entry.email || undefined,
    notificationConfigId: input.notificationConfigId || undefined,
    subject: input.subject || undefined,
    jobId: input.jobId,
    sentAt: entry.sentAt,
    sentBy: input.sentBy || undefined
  }));
  try {
    await memberEmailSend.insertMany(documents, { ordered: false });
  } catch (error) {
    errorDebugLog("recordMemberEmailSends failed for job", input.jobId, error);
  }
}
