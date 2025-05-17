import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../mongo/mongoose-client";
import {
  AuditRamblersUploadParams,
  CurrentUploadSession,
  ParsedRamblersUploadAudit,
  RamblersUploadAudit,
  Status
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { momentNowAsValue } from "../shared/dates";
import WebSocket from "ws";
import {
  MessageType,
  RamblersUploadAuditProgressResponse
} from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as auditParser from "./ramblers-audit-parser";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = true;
const currentUploadSession: CurrentUploadSession = {logStandardOut: false, fileName: null, record: 0};

export async function sendAudit<T>(ws: WebSocket, props: AuditRamblersUploadParams<T>) {
  return Promise.all(props.parserFunction(props.auditMessage, props.status).map((uploadAudit: ParsedRamblersUploadAudit) => {
    if (uploadAudit.audit) {
      currentUploadSession.record++;
      const data = uploadAudit.data;
      return mongooseClient.create<RamblersUploadAudit>(ramblersUploadAudit, {
        auditTime: data.auditTime || momentNowAsValue(),
        fileName: currentUploadSession.fileName,
        record: currentUploadSession.record,
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
    }
    return response;
  }).catch(error => reportErrorAndClose(error, ws));
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

export function registerUploadStart(fileName: string, ws: WebSocket): void {
  debugLog("✅ registered upload file name:", fileName);
  currentUploadSession.fileName = fileName;
  currentUploadSession.record = 0;
  currentUploadSession.logStandardOut = true;
  sendAudit(ws, {
    messageType: MessageType.PROGRESS,
    status: Status.INFO,
    auditMessage: `Upload started with file name ${fileName}`,
    parserFunction: auditParser.parseStandardOut
  });

}

export function queryCurrentUploadSession() {
  return {...currentUploadSession};
}

export function toggleStandardOutLogging(toggle: boolean): void {
  currentUploadSession.logStandardOut = toggle;
}

