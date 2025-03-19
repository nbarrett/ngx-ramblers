import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { ramblersUploadAudit } from "../models/ramblers-upload-audit";
import { parseError } from "./transforms";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { momentNow } from "../../shared/dates";
import {
  AuditType,
  FileUploadSummary,
  Status
} from "../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-audit"));
debugLog.enabled = false;

export async function queryUploadSessions(req: Request, res: Response): Promise<any> {
  const oneMonthAgo = momentNow().subtract(1, "month").valueOf();

  try {
    const detailedResult = await ramblersUploadAudit.aggregate([
      {
        $match: {
          auditTime: {$gt: oneMonthAgo}
        }
      },
      {
        $group: {
          _id: "$fileName",
          latestAuditTime: {$max: "$auditTime"},
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

    const fileUploadSummaries: FileUploadSummary[] = detailedResult.map(file => {
      const fileName = file._id;
      let status: Status;

      const hasError = file.records.some(record => record.errorResponse || record.status === Status.ERROR);
      if (hasError) {
        status = Status.ERROR;
      } else if (file.records.some(record =>
        ((record.type?.includes(AuditType.SUMMARY)) && record.status === Status.SUCCESS))) {
        status = Status.SUCCESS;
      } else if (!file.records.some(record => record.type?.includes(AuditType.SUMMARY))) {
        status = Status.ACTIVE;
      } else {
        status = Status.INFO;
      }

      return {
        fileName,
        status
      };
    });

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
