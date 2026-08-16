import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { ramblersUploadAudit } from "../models/ramblers-upload-audit";
import { parseError } from "./transforms";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { dateTimeNow } from "../../shared/dates";
import {
  AuditType,
  FileUploadSummary,
  Status
} from "../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { asNumber } from "../../../../projects/ngx-ramblers/src/app/functions/numbers";
import { isString } from "es-toolkit/compat";
import {
  isSerenityFeature,
  resolvedSerenityFeature,
  SerenityFeature
} from "../../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-audit"));
debugLog.enabled = false;

export async function queryUploadSessions(req: Request, res: Response): Promise<any> {
  const monthsInput = (req.query.months as string) || "";
  const monthsParam = asNumber(monthsInput);
  const months = monthsInput ? Math.max(1, monthsParam) : 6;
  const threshold = dateTimeNow().minus({ months }).toMillis();

  try {
    const detailedResult = await ramblersUploadAudit.aggregate([
      { $match: { auditTime: { $gt: threshold } } },
      {
        $group: {
          _id: "$fileName",
          latestAuditTime: {$max: "$auditTime"},
          earliestAuditTime: {$min: "$auditTime"},
          feature: {$first: "$feature"},
          records: {
            $push: {
              status: "$status",
              type: "$type",
              errorResponse: "$errorResponse"
            }
          }
        }
      },
      {
        $sort: {
          latestAuditTime: -1
        }
      }
    ]);

    const requestedFeature = isString(req.query.feature) && isSerenityFeature(req.query.feature)
      ? req.query.feature
      : SerenityFeature.WALKS_UPLOAD;
    const fileUploadSummaries: FileUploadSummary[] = detailedResult.map(file => {
      const fileName = file._id;
      const statusProgress = {value: Status.INFO};

      const hasError = file.records.some(record => record.errorResponse || record.status === Status.ERROR);
      if (hasError) {
        statusProgress.value = Status.ERROR;
      } else if (file.records.some(record =>
        ((record.type?.includes(AuditType.SUMMARY)) && record.status === Status.SUCCESS))) {
        statusProgress.value = Status.SUCCESS;
      } else if (!file.records.some(record => record.type?.includes(AuditType.SUMMARY))) {
        statusProgress.value = Status.ACTIVE;
      } else {
        statusProgress.value = Status.INFO;
      }

      return {
        fileName,
        feature: resolvedSerenityFeature(fileName, file.feature),
        status: statusProgress.value,
        earliestAuditTime: file.earliestAuditTime,
        latestAuditTime: file.latestAuditTime
      };
    }).filter(session => session.feature === requestedFeature);

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
