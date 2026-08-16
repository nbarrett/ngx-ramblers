import { inject, Injectable } from "@angular/core";
import { isArray } from "es-toolkit/compat";
import {
  followCacheKey,
  RouteFollowOfflineStatus,
  RouteFollowPayload,
  RouteFollowSummary
} from "../../models/route-follow.model";
import { DateUtilsService } from "../date-utils.service";

const DB_NAME = "ngx-follow";
const DB_VERSION = 1;
const ROUTES_STORE = "routes";

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
  private dbPromise: Promise<IDBDatabase> | null = null;

  keyForPayload(payload: RouteFollowPayload): string | null {
    return followCacheKey({
      path: payload.path,
      routeId: payload.routeId,
      walkId: payload.walkId,
      ramblersSlug: payload.ramblersSlug
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
    const record = await this.cached(key);
    return record?.payload || null;
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
    const records = await this.allRoutes();
    return records.map(record => ({
      source: record.payload.source,
      title: record.payload.title,
      path: record.payload.path,
      walkId: record.payload.walkId,
      routeId: record.payload.routeId,
      ramblersSlug: record.payload.ramblersSlug,
      distanceMiles: record.payload.guide?.distanceMiles || null,
      startDescription: record.payload.guide?.startDescription || null
    }));
  }

  async statusByKey(): Promise<Record<string, RouteFollowOfflineStatus>> {
    const records = await this.allRoutes();
    return records.reduce((acc, record) => {
      acc[record.key] = record.tilesReady ? RouteFollowOfflineStatus.AVAILABLE : RouteFollowOfflineStatus.SAVING;
      return acc;
    }, {} as Record<string, RouteFollowOfflineStatus>);
  }

  async prefetchTiles(urls: string[], onProgress?: (done: number, total: number) => void): Promise<{saved: number; total: number}> {
    const unique = urls.filter((url, index) => urls.indexOf(url) === index);
    const result = await unique.reduce(async (previous, url, index) => {
      const acc = await previous;
      try {
        await fetch(url, {mode: "cors", credentials: "same-origin"});
        const next = {saved: acc.saved + 1, total: unique.length};
        if (onProgress) {
          onProgress(index + 1, unique.length);
        }
        return next;
      } catch {
        if (onProgress) {
          onProgress(index + 1, unique.length);
        }
        return {...acc, total: unique.length};
      }
    }, Promise.resolve({saved: 0, total: unique.length}));
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
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(ROUTES_STORE)) {
            db.createObjectStore(ROUTES_STORE, {keyPath: "key"});
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return this.dbPromise;
    }
  }
}
