import { Request, Response } from "express";
import debug from "debug";
import { memberAuthAudit } from "../models/member-auth-audit";
import { envConfig } from "../../env-config/env-config";
import { parseError } from "./transforms";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { latestLoginsFromAudits } from "../../../../projects/ngx-ramblers/src/app/functions/member-latest-login";
import { MemberLoginAuditSource } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const debugLog = debug(envConfig.logNamespace("member-auth-audit"));
debugLog.enabled = false;

export async function latestLoginTimes(req: Request, res: Response): Promise<void> {
  try {
    const documents = await memberAuthAudit.find({})
      .select("userName loginTime member.memberId")
      .lean()
      .exec();
    const response = latestLoginsFromAudits(documents as MemberLoginAuditSource[]);
    debugLog(req.query, "latestLoginTimes", response.length);
    res.status(200).json({
      action: ApiAction.QUERY,
      response
    });
  } catch (error) {
    debugLog("latestLoginTimes error:", error);
    res.status(500).json({
      message: "member-auth-audit latest login times query failed",
      error: parseError(error)
    });
  }
}
