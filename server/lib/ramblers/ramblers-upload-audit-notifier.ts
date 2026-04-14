import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../mongo/mongoose-client";
import {
  AuditRamblersUploadParams,
  AuditType,
  CurrentUploadSession,
  ParsedRamblersUploadAudit,
  RamblersUploadAudit,
  Status
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { dateTimeNowAsValue } from "../shared/dates";
import WebSocket from "ws";
import {
  MessageType,
  RamblersUploadAuditProgressResponse
} from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as auditParser from "./ramblers-audit-parser";
import {
  completeRamblersUploadSession,
  currentRamblersUploadSession,
  registerRamblersUploadSession,
  updateRamblersUploadSession
} from "./ramblers-upload-session-registry";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = false;

export async function sendAudit<T>(ws: WebSocket, props: AuditRamblersUploadParams<T>, jobId?: string) {
  const session = currentRamblersUploadSession(jobId);

  if (!session) {
    throw new Error(`No active upload session found for audit publication${jobId ? ` (${jobId})` : ""}`);
  }

  return Promise.all(props.parserFunction(props.auditMessage, props.status).map((uploadAudit: ParsedRamblersUploadAudit) => {
    if (uploadAudit.audit) {
      const nextRecord = session.record + 1;
      updateRamblersUploadSession(session.jobId, { record: nextRecord });
      const data = uploadAudit.data;
      return mongooseClient.create<RamblersUploadAudit>(ramblersUploadAudit, {
        auditTime: data.auditTime || dateTimeNowAsValue(),
        fileName: session.fileName,
        record: nextRecord,
        type: data.type,
        status: data.status,
        message: data.message,
      }, debugLog);
    } else {
      return Promise.resolve(null);
    }
  })).then((unfilteredAuditRecords: any[]) => {
    const audits: RamblersUploadAudit[] = unfilteredAuditRecords.filter(item => item);
    const response: RamblersUploadAuditProgressResponse = {audits};
    const publishedData = JSON.stringify({
      type: props.messageType,
      data: response
    });
    ws.send(publishedData);
    debugLog("📣 published data:", publishedData);
    if (props.messageType === MessageType.COMPLETE) {
      ws.close();
      completeRamblersUploadSession(session.jobId);
    }
    return response;
  }).catch(error => reportErrorAndClose(error, ws));
}

export async function recordLifecycleEvent(jobId: string, message: string): Promise<void> {
  const session = currentRamblersUploadSession(jobId);
  if (!session) {
    debugLog("recordLifecycleEvent: no session for jobId:", jobId, "— skipping");
    return;
  }
  const nextRecord = session.record + 1;
  updateRamblersUploadSession(session.jobId, { record: nextRecord });
  const audit = await mongooseClient.create<RamblersUploadAudit>(ramblersUploadAudit, {
    auditTime: dateTimeNowAsValue(),
    fileName: session.fileName,
    record: nextRecord,
    type: AuditType.SUMMARY,
    status: Status.SUCCESS,
    message
  }, debugLog);
  if (session.ws && session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: { audits: [audit] }
    }));
  }
}

export async function recordReportLocation(jobId: string, bucket: string, keyPrefix: string): Promise<void> {
  const session = currentRamblersUploadSession(jobId);
  if (!session) {
    debugLog("recordReportLocation: no session for jobId:", jobId, "— skipping");
    return;
  }
  const nextRecord = session.record + 1;
  updateRamblersUploadSession(session.jobId, { record: nextRecord });
  const reportAudit = await mongooseClient.create<RamblersUploadAudit>(ramblersUploadAudit, {
    auditTime: dateTimeNowAsValue(),
    fileName: session.fileName,
    record: nextRecord,
    type: AuditType.SUMMARY,
    status: Status.SUCCESS,
    message: `Serenity report archive stored at s3://${bucket}/${keyPrefix}.zip`,
    reportKeyPrefix: keyPrefix,
    reportBucket: bucket
  }, debugLog);
  if (session.ws && session.ws.readyState === session.ws.OPEN) {
    session.ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: { audits: [reportAudit] }
    }));
  }
}

export function reportErrorAndClose(error, ws: WebSocket) {
  debugLog(`❌ Ramblers walks upload failed:`, (error as Error).message);
  ws.send(JSON.stringify({
    type: MessageType.ERROR,
    data: {
      responseData: [],
      error,
      information: "Ramblers walks upload failed"
    }
  }));
  ws.close();
}

export function registerUploadStart(fileName: string, ws: WebSocket, jobId: string): void {
  debugLog("✅ registered upload file name:", fileName);
  registerRamblersUploadSession(jobId, fileName, ws);
  sendAudit(ws, {
    messageType: MessageType.PROGRESS,
    status: Status.INFO,
    auditMessage: `Upload started with file name ${fileName}`,
    parserFunction: auditParser.parseStandardOut
  }, jobId);

}

export function queryCurrentUploadSession(jobId?: string): CurrentUploadSession | null {
  const session = currentRamblersUploadSession(jobId);
  return session ? { ...session } : null;
}

export function toggleStandardOutLogging(toggle: boolean, jobId?: string): void {
  const session = currentRamblersUploadSession(jobId);
  if (session) {
    updateRamblersUploadSession(session.jobId, { logStandardOut: toggle });
  }
}
