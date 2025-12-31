import debug from "debug";
import { DateTime } from "luxon";
import WebSocket from "ws";
import {
  DateFormat,
  RamblersEventType
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventPopulation, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import {
  GroupEvent,
  InputSource
} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import axios from "axios";
import { dateTimeNowAsValue } from "../shared/dates";
import { cacheEventsWithStats } from "./walks-manager-cache";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

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

    const dateFrom = options.dateFrom || (options.fullSync
      ? DateTime.now().minus({ years: 3 })
      : DateTime.now().minus({ days: 7 }));

    const dateTo = options.dateTo || DateTime.now().plus({ years: 2 });

    debugLog("Sync date range:", {
      from: dateFrom.toFormat(DateFormat.DISPLAY_DATE_FULL),
      to: dateTo.toFormat(DateFormat.DISPLAY_DATE_FULL)
    });

    const groupCode = determineGroupCode(config);
    debugLog("Syncing for group code:", groupCode);

    sendProgress(ws, 2, "Cleaning up orphaned data...");

    const countBefore = await extendedGroupEvent.countDocuments({
      [`${EventField.INPUT_SOURCE}`]: InputSource.URL_TO_ID_LOOKUP
    }).exec();

    debugLog(`Found ${countBefore} URL_TO_ID_LOOKUP records to delete`);

    const deleteResult = await extendedGroupEvent.deleteMany({
      [`${EventField.INPUT_SOURCE}`]: InputSource.URL_TO_ID_LOOKUP
    }).exec();

    result.deleted = deleteResult.deletedCount;
    debugLog(`Deleted ${result.deleted} URL_TO_ID_LOOKUP records`);

    sendProgress(ws, 5, "Cleanup complete");

    const requestBody = {
      suppressEventLinking: false,
      types: [RamblersEventType.GROUP_WALK],
      date: dateFrom.toFormat(DateFormat.WALKS_MANAGER_API),
      dateEnd: dateTo.toFormat(DateFormat.WALKS_MANAGER_API),
      order: "asc",
      sort: "date",
      rawData: true,
      limit: 300,
      ids: [],
      groupCode,
      inputSource: InputSource.WALKS_MANAGER_CACHE
    };

    debugLog("Calling list-events with body:", requestBody);
    sendProgress(ws, 10, "Fetching walks from Walks Manager...");

    const response = await axios.post("http://localhost:5001/api/ramblers/walks-manager/list-events", requestBody);
    const events: GroupEvent[] = response.data?.response?.data || [];

    debugLog(`Received ${events.length} events from API`);
    sendProgress(ws, 85, `Received ${events.length} events`);

    sendProgress(ws, 90, "Caching events to database...");
    const {added, updated} = await cacheEventsWithStats(config, events, InputSource.WALKS_MANAGER_CACHE);
    result.added = added;
    result.updated = updated;
    result.totalProcessed = events.length;

    debugLog(`Sync completed: ${result.added} events cached from Walks Manager`);
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
  const useArea = config.area?.walkPopulation === EventPopulation.WALKS_MANAGER;
  const useGroup = config.group?.walkPopulation === EventPopulation.WALKS_MANAGER;

  if (useArea) {
    debugLog("Using area mode - fetching walks for area code:", config.area.groupCode);
    return config.area.groupCode;
  } else if (useGroup) {
    debugLog("Using group mode - fetching walks for group code:", config.group.groupCode);
    return config.group.groupCode;
  } else {
    debugLog("No walks-manager population configured, defaulting to group code:", config.group?.groupCode);
    return config.group?.groupCode;
  }
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
  return typeof lastSyncedAt === "number" ? lastSyncedAt : new Date(lastSyncedAt).getTime();
}
