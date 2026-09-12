import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { ramblersUploadAudit } from "../models/ramblers-upload-audit";
import { parseError } from "./transforms";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { dateTimeNow } from "../../shared/dates";
import {
  FileUploadSummary,
  Status
} from "../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { UPLOAD_FINISHED_MESSAGE_PATTERN } from "../../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { asNumber } from "../../../../projects/ngx-ramblers/src/app/functions/numbers";
import { isString } from "es-toolkit/compat";
import {
  isSerenityFeature,
  SERENITY_FEATURE_FILE_NAMES,
  SerenityFeature
} from "../../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-audit"));
debugLog.enabled = false;

const MAX_UPLOAD_SESSIONS = 100;

interface UploadSessionAggregate {
  errorCount: number;
  finishedCount: number;
}

function uploadSessionStatus(session: UploadSessionAggregate): Status {
  if (session.finishedCount === 0) {
    return Status.ACTIVE;
  } else if (session.errorCount > 0) {
    return Status.ERROR;
  } else {
    return Status.SUCCESS;
  }
}

export async function queryUploadSessions(req: Request, res: Response): Promise<any> {
  const monthsInput = (req.query.months as string) || "";
  const monthsParam = asNumber(monthsInput);
  const months = monthsInput ? Math.max(1, monthsParam) : 6;
  const threshold = dateTimeNow().minus({ months }).toMillis();
  const feature = isString(req.query.feature) && isSerenityFeature(req.query.feature)
    ? req.query.feature
    : SerenityFeature.WALKS_UPLOAD;

  try {
    const sessions = await ramblersUploadAudit.aggregate([
      {
        $match: {
          fileName: {$regex: `^${SERENITY_FEATURE_FILE_NAMES[feature].prefix}`},
          auditTime: {$gt: threshold}
        }
      },
      {
        $group: {
          _id: "$fileName",
          latestAuditTime: {$max: "$auditTime"},
          earliestAuditTime: {$min: "$auditTime"},
          errorCount: {
            $sum: {$cond: [{$or: [{$ne: [{$ifNull: ["$errorResponse", null]}, null]}, {$eq: ["$status", Status.ERROR]}]}, 1, 0]}
          },
          finishedCount: {
            $sum: {$cond: [{$regexMatch: {input: {$ifNull: ["$message", ""]}, regex: UPLOAD_FINISHED_MESSAGE_PATTERN}}, 1, 0]}
          }
        }
      },
      {$sort: {latestAuditTime: -1}},
      {$limit: MAX_UPLOAD_SESSIONS}
    ]);

    const fileUploadSummaries: FileUploadSummary[] = sessions.map(session => ({
      fileName: session._id,
      feature,
      status: uploadSessionStatus(session),
      earliestAuditTime: session.earliestAuditTime,
      latestAuditTime: session.latestAuditTime
    }));

    debugLog(req.query, "queryUploadSessions:fileUploadSummaries", fileUploadSummaries);
    return res.status(200).json({
      action: ApiAction.QUERY,
      response: fileUploadSummaries
    });
  } catch (error) {
    debugLog(`queryUploadSessions: ${ramblersUploadAudit.modelName} error: ${error}`);
    res.status(500).json({
      message: `${ramblersUploadAudit.modelName} query failed`,
      error: parseError(error)
    });
  }
}
