import debug from "debug";
import { DateTime } from "luxon";
import WebSocket from "ws";
import {
  DateFormat,
  RamblersEventType,
  RamblersEventsApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventPopulation, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import {
  GroupEvent,
  InputSource
} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { dateTimeFromIso, dateTimeFromJsDate, dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { cacheEventsWithStats, cleanupDuplicatesByRamblersId } from "./walks-manager-cache";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import * as requestDefaults from "../ramblers/request-defaults";
import { isEmpty, isNumber, isString } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("walks-manager-sync"));
debugLog.enabled = true;

function sendProgress(ws: WebSocket | null, percent: number, message: string): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: MessageType.PROGRESS,
        data: { percent, message }
      }));
      debugLog(`Progress sent: ${percent}% - ${message}`);
    } catch (error) {
      debugLog("Failed to send progress:", error);
    }
  }
}

function sendComplete(ws: WebSocket | null, data: any): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: MessageType.COMPLETE,
        data
      }));
      debugLog("Sync complete message sent");
    } catch (error) {
      debugLog("Failed to send complete:", error);
    }
  }
}

function sendError(ws: WebSocket | null, message: string): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: MessageType.ERROR,
        data: { message }
      }));
      debugLog("Error message sent:", message);
    } catch (error) {
      debugLog("Failed to send error:", error);
    }
  }
}

export interface SyncOptions {
  fullSync?: boolean;
  dateFrom?: DateTime;
  dateTo?: DateTime;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  lastSyncedAt: number;
  totalProcessed: number;
}

export async function syncWalksManagerData(
  config: SystemConfig,
  options: SyncOptions = {},
  ws: WebSocket | null = null
): Promise<SyncResult> {
  const result: SyncResult = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: [],
    lastSyncedAt: dateTimeNowAsValue(),
    totalProcessed: 0
  };

  try {
    debugLog("Starting WALKS_MANAGER sync with options:", options);
    sendProgress(ws, 0, "Starting sync...");

    if (config.group.walkPopulation === EventPopulation.LOCAL) {
      debugLog("Walk population is LOCAL, skipping sync");
      sendProgress(ws, 100, "Sync skipped: walk population is LOCAL");
      sendComplete(ws, {
        ...result,
        percent: 100,
        message: "Sync skipped: walk population is LOCAL"
      });
      return result;
    }

    const dateFrom = options.dateFrom || (options.fullSync
      ? dateTimeNow().minus({ years: 3 })
      : dateTimeNow().minus({ days: 7 }));

    const dateTo = options.dateTo || dateTimeNow().plus({ years: 2 });

    debugLog("Sync date range:", {
      from: dateFrom.toFormat(DateFormat.DISPLAY_DATE_FULL),
      to: dateTo.toFormat(DateFormat.DISPLAY_DATE_FULL)
    });

    const groupCode = determineGroupCode(config);
    debugLog("Syncing for group code:", groupCode);

    sendProgress(ws, 2, "Cleaning up duplicates...");
    const cleanupStats = await cleanupDuplicatesByRamblersId();
    if (cleanupStats.duplicatesRemoved > 0) {
      debugLog(`Cleanup removed ${cleanupStats.duplicatesRemoved} duplicate walks across ${cleanupStats.ramblersIdsProcessed} groupEvent.id values`);
      cleanupStats.details.forEach(detail => {
        debugLog(`  groupEvent.id ${detail.groupEventId}: kept ${detail.keptDocId}, deleted [${detail.deletedDocIds.join(", ")}]`);
      });
      result.deleted = cleanupStats.duplicatesRemoved;
    }

    sendProgress(ws, 5, "Sync starting");
    const defaultOptions = requestDefaults.createApiRequestOptions(config);
    const totalMonths = Math.ceil(dateTo.diff(dateFrom, "months").months);
    const chunkSizeMonths = options.fullSync ? 1 : Math.ceil(totalMonths);
    const limit = 100;

    debugLog(`Total sync span: ${totalMonths} months, processing in ${chunkSizeMonths}-month chunks`);

    const fetchChunkPage = async (
      currentDate: DateTime,
      chunkEnd: DateTime,
      progressPercent: number,
      progressMessage: string,
      offset: number,
      acc: GroupEvent[]
    ): Promise<GroupEvent[]> => {
      const buildParameters = () => [
        optionalParameter("groups", groupCode),
        optionalParameter("types", [RamblersEventType.GROUP_WALK, RamblersEventType.GROUP_EVENT]),
        optionalParameter("limit", limit),
        optionalParameter("offset", offset),
        optionalParameter("sort", "date"),
        optionalParameter("order", "asc"),
        optionalParameter("date", currentDate.toFormat(DateFormat.WALKS_MANAGER_API)),
        optionalParameter("date_end", chunkEnd.toFormat(DateFormat.WALKS_MANAGER_API))
      ].filter(item => !isEmpty(item)).join("&");

      const pageProgressMessage = acc.length > 0
        ? `${progressMessage} - fetched ${acc.length} events...`
        : progressMessage;

      debugLog(`Fetching page at offset ${offset} with limit ${limit}`);
      sendProgress(ws, progressPercent, pageProgressMessage);

      const apiResponse: RamblersEventsApiResponse = await httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${buildParameters()}`
        },
        debug: debugLog
      }) as RamblersEventsApiResponse;

      const pageData = apiResponse.response?.data || [];
      const totalInChunk = apiResponse.response?.summary?.total || 0;

      debugLog(`Received ${pageData.length} events, ${totalInChunk} total in date range`);

      const newAcc = pageData.length > 0 ? [...acc, ...pageData] : acc;
      const nextOffset = offset + limit;
      const hasMore = nextOffset < totalInChunk && pageData.length === limit;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return fetchChunkPage(currentDate, chunkEnd, progressPercent, progressMessage, nextOffset, newAcc);
      }
      return newAcc;
    };

    const processChunk = async (currentDate: DateTime, processedMonths: number): Promise<void> => {
      if (!(currentDate < dateTo)) return;
      const chunkEnd = DateTime.min(currentDate.plus({ months: chunkSizeMonths }), dateTo);
      debugLog(`Processing chunk: ${currentDate.toFormat(DateFormat.DISPLAY_DATE_FULL)} to ${chunkEnd.toFormat(DateFormat.DISPLAY_DATE_FULL)}`);

      const progressPercent = 5 + Math.round((processedMonths / totalMonths) * 85);
      const progressMessage = `Syncing ${currentDate.toFormat("MMM yyyy")}`;
      sendProgress(ws, progressPercent, progressMessage);

      try {
        const allEventsInChunk = await fetchChunkPage(currentDate, chunkEnd, progressPercent, progressMessage, 0, []);

        const uniqueEventsMap = new Map<string, GroupEvent>();
        allEventsInChunk.forEach(event => {
          if (event.id) {
            uniqueEventsMap.set(event.id, event);
          }
        });
        const uniqueEvents = Array.from(uniqueEventsMap.values());

        const duplicatesFiltered = allEventsInChunk.length - uniqueEvents.length;
        if (duplicatesFiltered > 0) {
          debugLog(`Filtered ${duplicatesFiltered} duplicate events from API responses`);
        }

        if (uniqueEvents.length > 0) {
          sendProgress(ws, progressPercent, `${progressMessage} - caching ${uniqueEvents.length} unique events...`);

          const {added, updated} = await cacheEventsWithStats(config, uniqueEvents, InputSource.WALKS_MANAGER_CACHE);
          result.added += added;
          result.updated += updated;
          result.totalProcessed += uniqueEvents.length;

          debugLog(`Chunk processed: ${added} added, ${updated} updated from ${uniqueEvents.length} unique events (${duplicatesFiltered} duplicates filtered)`);
        }

        debugLog(`Chunk complete: ${uniqueEvents.length} unique events processed`);
      } catch (error) {
        const errorMsg = `Failed to sync chunk ${currentDate.toISO()}: ${error.message}`;
        debugLog(errorMsg);
        result.errors.push(errorMsg);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      return processChunk(chunkEnd, processedMonths + chunkSizeMonths);
    };

    await processChunk(dateFrom, 0);

    debugLog(`Sync completed: ${result.added} added, ${result.updated} updated from ${result.totalProcessed} total events`);
    sendProgress(ws, 100, "Sync complete");
    sendComplete(ws, {
      ...result,
      percent: 100,
      message: `Sync complete: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`
    });

    return result;
  } catch (error) {
    debugLog("Sync error:", error);
    const errorMessage = `Sync failed: ${error.message}`;
    result.errors.push(errorMessage);
    sendError(ws, errorMessage);
    return result;
  }
}

function determineGroupCode(config: SystemConfig): string {
  debugLog("Fetching walks for group code:", config.group.groupCode);
  return config.group.groupCode;
}

export async function getLastSyncTimestamp(groupCode: string): Promise<number | null> {
  const latestSync = await extendedGroupEvent
    .findOne({ [`${EventField.INPUT_SOURCE}`]: InputSource.WALKS_MANAGER_CACHE })
    .sort({ lastSyncedAt: -1 })
    .exec();

  const lastSyncedAt = latestSync?.lastSyncedAt as any;
  if (!lastSyncedAt) {
    return null;
  }
  if (isNumber(lastSyncedAt)) {
    return lastSyncedAt;
  }
  if (isString(lastSyncedAt)) {
    const parsed = dateTimeFromIso(lastSyncedAt);
    return parsed.isValid ? parsed.toMillis() : null;
  }
  return dateTimeFromJsDate(lastSyncedAt as Date).toMillis();
}
