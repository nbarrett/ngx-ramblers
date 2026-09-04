import { inject, Injectable } from "@angular/core";
import { isArray } from "es-toolkit/compat";
import {
  followCacheKey,
  RouteFollowOfflineStatus,
  RouteFollowPayload,
  RouteFollowSummary
} from "../../models/route-follow.model";
import { DateUtilsService } from "../date-utils.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";

const DB_NAME = "ngx-follow";
const DB_VERSION = 1;
const ROUTES_STORE = "routes";
const DB_OPEN_TIMEOUT_MS = 5000;

export interface CachedFollowRoute {
  key: string;
  payload: RouteFollowPayload;
  savedAt: number;
  tilesReady: boolean;
  tileCount: number;
}

@Injectable({
  providedIn: "root"
})
export class RouteFollowCacheService {
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("RouteFollowCacheService", NgxLoggerLevel.ERROR);
  private dbPromise: Promise<IDBDatabase> | null = null;

  keyForPayload(payload: RouteFollowPayload): string | null {
    return followCacheKey({
      path: payload.path,
      routeId: payload.routeId,
      walkId: payload.walkId,
      ramblersSlug: payload.ramblersSlug,
      osMapsRouteId: payload.osMapsRouteId
    });
  }

  async savePayload(payload: RouteFollowPayload): Promise<string | null> {
    const key = this.keyForPayload(payload);
    if (!key) {
      return null;
    } else {
      const existing = await this.cached(key);
      const record: CachedFollowRoute = {
        key,
        payload,
        savedAt: this.dateUtils.dateTimeNowAsValue(),
        tilesReady: existing?.tilesReady || false,
        tileCount: existing?.tileCount || 0
      };
      await this.putRoute(record);
      return key;
    }
  }

  async markTiles(key: string, tileCount: number, tilesReady: boolean): Promise<void> {
    const existing = await this.cached(key);
    if (existing) {
      await this.putRoute({...existing, tileCount, tilesReady, savedAt: this.dateUtils.dateTimeNowAsValue()});
    }
  }

  async cached(key: string): Promise<CachedFollowRoute | null> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction(ROUTES_STORE, "readonly").objectStore(ROUTES_STORE).get(key);
      request.onsuccess = () => resolve((request.result as CachedFollowRoute) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async payload(key: string): Promise<RouteFollowPayload | null> {
    try {
      const record = await this.cached(key);
      return record?.payload || null;
    } catch (error) {
      this.logger.warn("route cache read failed for", key, error);
      return null;
    }
  }

  async status(key: string | null): Promise<RouteFollowOfflineStatus> {
    if (!key) {
      return RouteFollowOfflineStatus.NEEDS_NETWORK;
    } else {
      const record = await this.cached(key);
      if (record?.tilesReady) {
        return RouteFollowOfflineStatus.AVAILABLE;
      } else if (record) {
        return RouteFollowOfflineStatus.SAVING;
      } else {
        return RouteFollowOfflineStatus.NEEDS_NETWORK;
      }
    }
  }

  async summaries(): Promise<RouteFollowSummary[]> {
    const records = await this.allRoutesOrNone();
    return records.map(record => ({
      source: record.payload.source,
      title: record.payload.title,
      path: record.payload.path,
      walkId: record.payload.walkId,
      routeId: record.payload.routeId,
      ramblersSlug: record.payload.ramblersSlug,
      distanceMiles: record.payload.guide?.distance_miles || null,
      startDescription: record.payload.guide?.start_location?.description || record.payload.guide?.start_location?.postcode || null
    }));
  }

  async statusByKey(): Promise<Record<string, RouteFollowOfflineStatus>> {
    const records = await this.allRoutesOrNone();
    return records.reduce((acc, record) => {
      acc[record.key] = record.tilesReady ? RouteFollowOfflineStatus.AVAILABLE : RouteFollowOfflineStatus.SAVING;
      return acc;
    }, {} as Record<string, RouteFollowOfflineStatus>);
  }

  private async allRoutesOrNone(): Promise<CachedFollowRoute[]> {
    try {
      return await this.allRoutes();
    } catch (error) {
      this.logger.warn("route cache unavailable:", error);
      return [];
    }
  }

  async prefetchTiles(urls: string[], onProgress?: (done: number, total: number, bytes: number) => void): Promise<{saved: number; total: number; bytes: number}> {
    const unique = urls.filter((url, index) => urls.indexOf(url) === index);
    const result = await unique.reduce(async (previous, url, index) => {
      const acc = await previous;
      try {
        const response = await fetch(url, {mode: "cors", credentials: "same-origin"});
        const buffer = await response.arrayBuffer();
        const next = {saved: acc.saved + 1, total: unique.length, bytes: acc.bytes + buffer.byteLength};
        if (onProgress) {
          onProgress(index + 1, unique.length, next.bytes);
        }
        return next;
      } catch {
        if (onProgress) {
          onProgress(index + 1, unique.length, acc.bytes);
        }
        return {...acc, total: unique.length};
      }
    }, Promise.resolve({saved: 0, total: unique.length, bytes: 0}));
    return result;
  }

  private async allRoutes(): Promise<CachedFollowRoute[]> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction(ROUTES_STORE, "readonly").objectStore(ROUTES_STORE).getAll();
      request.onsuccess = () => resolve(isArray(request.result) ? request.result as CachedFollowRoute[] : []);
      request.onerror = () => reject(request.error);
    });
  }

  private async putRoute(record: CachedFollowRoute): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction(ROUTES_STORE, "readwrite").objectStore(ROUTES_STORE).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private database(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    } else {
      this.dbPromise = new Promise((resolve, reject) => {
        const settle = (outcome: () => void) => {
          window.clearTimeout(timer);
          outcome();
        };
        const fail = (reason: unknown) => settle(() => {
          this.dbPromise = null;
          reject(reason);
        });
        const timer = window.setTimeout(() => fail(new Error("Route cache did not open in time")), DB_OPEN_TIMEOUT_MS);
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ROUTES_STORE)) {
              db.createObjectStore(ROUTES_STORE, {keyPath: "key"});
            }
          };
          request.onsuccess = () => settle(() => resolve(request.result));
          request.onerror = () => fail(request.error);
          request.onblocked = () => fail(new Error("Route cache is blocked by another open tab"));
        } catch (error) {
          fail(error);
        }
      });
      return this.dbPromise;
    }
  }
}
