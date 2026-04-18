import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import {
  IntegrationWorkerMigrationProgressCallback,
  IntegrationWorkerMigrationResultCallback
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { migrationHistory } from "../mongo/models/migration-history";
import { dateTimeNowAsValue } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";
import { MigrationSession } from "./migration-session-registry";

const debugLog = debug(envConfig.logNamespace("migration-notifier"));
debugLog.enabled = true;

export async function emitMigrationProgress(session: MigrationSession, event: IntegrationWorkerMigrationProgressCallback): Promise<void> {
  const payload = { message: event.message };
  try {
    session.ws.send(JSON.stringify({
      type: event.level === "error" ? MessageType.ERROR : MessageType.PROGRESS,
      data: payload
    }));
  } catch (wsError) {
    debugLog("emitMigrationProgress: ws.send failed:", (wsError as Error).message);
  }
  await appendMigrationAudit(session.historyId, { status: event.level, message: event.message });
}

export async function emitMigrationResult(session: MigrationSession, result: IntegrationWorkerMigrationResultCallback): Promise<void> {
  if (result.status === "error") {
    const message = result.errorMessage || "Migration failed";
    try {
      session.ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message } }));
    } catch (wsError) {
      debugLog("emitMigrationResult error: ws.send failed:", (wsError as Error).message);
    }
    await finaliseHistory(session.historyId, { status: "error", summary: message });
    return;
  }

  const migrationResult = result.result;
  const pageCount = migrationResult?.pageContents?.length ?? 0;
  const contentTextCount = migrationResult?.contentTextItems?.length ?? 0;
  const albumCount = migrationResult?.albums?.length ?? 0;
  const summary = `✅ ${session.siteIdentifier} migration complete: ${pluraliseWithCount(pageCount, "page")} and ${pluraliseWithCount(contentTextCount, "content text item")} were migrated, plus ${pluraliseWithCount(albumCount, "album")}`;

  try {
    session.ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: {
        action: ApiAction.UPDATE,
        response: summary,
        pageContents: migrationResult?.pageContents || [],
        contentTextItems: migrationResult?.contentTextItems || [],
        albums: migrationResult?.albums || []
      }
    }));
  } catch (wsError) {
    debugLog("emitMigrationResult success: ws.send failed:", (wsError as Error).message);
  }

  await finaliseHistory(session.historyId, { status: "success", summary });
}

async function appendMigrationAudit(historyId: string, entry: { status: string; message: string }): Promise<void> {
  try {
    const doc = await (migrationHistory as any).findById(historyId).lean().exec();
    if (!doc) {
      return;
    }
    const auditLog = [...(doc.auditLog || []), { time: dateTimeNowAsValue(), status: entry.status, message: entry.message }];
    await mongooseClient.upsert<any>(migrationHistory as any, { _id: historyId }, { ...doc, auditLog } as any);
  } catch (error) {
    debugLog("appendMigrationAudit failed:", (error as Error).message);
  }
}

async function finaliseHistory(historyId: string, fields: { status: string; summary: string }): Promise<void> {
  try {
    const doc = await (migrationHistory as any).findById(historyId).lean().exec();
    if (!doc) {
      return;
    }
    await mongooseClient.upsert<any>(migrationHistory as any, { _id: historyId }, {
      ...doc,
      completedDate: dateTimeNowAsValue(),
      status: fields.status,
      summary: fields.summary
    } as any);
  } catch (error) {
    debugLog("finaliseHistory failed:", (error as Error).message);
  }
}
