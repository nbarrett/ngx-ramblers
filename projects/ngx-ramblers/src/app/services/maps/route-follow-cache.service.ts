import { MemberLoginService } from "../member/member-login.service";
import { routeEditableByMember, routeVisibleToMember } from "../../functions/route-access";
import { inject, Injectable } from "@angular/core";
import { isArray, isEqual } from "es-toolkit/compat";
import {
  CachedFollowRoute,
  followCacheKey,
  ROUTE_PREVIEW_MAX_POINTS,
  ROUTE_PREVIEW_SPACING_METRES,
  RouteFollowOfflineStatus,
  RouteFollowPayload,
  RouteFollowPoint,
  RouteFollowSource,
  RouteFollowSummary
} from "../../models/route-follow.model";
import { simplifiedRoutePoints } from "../../functions/route-geometry";
import { DateUtilsService } from "../date-utils.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";

import { LegacyWalkingRoute } from "../../models/legacy-walking-recovery.model";
import { nativeWalkingSite, nativeWalkingStorageKey } from "../../functions/native-walking";
import { fetchFollowTile } from "../../functions/follow-tile-cache";

const DB_NAME = "ngx-follow";
const DB_VERSION = 1;
const ROUTES_STORE = "routes";
const DB_OPEN_TIMEOUT_MS = 5000;

@Injectable({
  providedIn: "root"
})
export class RouteFollowCacheService {
  private memberLogin = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("RouteFollowCacheService", NgxLoggerLevel.ERROR);
  private dbName: string | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  keyForPayload(payload: RouteFollowPayload): string | null {
    return followCacheKey({
      recordingId: payload.recordingId,
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
      const sameMap = existing?.payload.provider === payload.provider && existing?.payload.osStyle === payload.osStyle && isEqual(existing?.payload.points, payload.points);
      const record: CachedFollowRoute = {
        key,
        payload,
        savedAt: this.dateUtils.dateTimeNowAsValue(),
        tilesReady: sameMap && !!existing?.tilesReady,
        tileCount: sameMap ? existing?.tileCount || 0 : 0
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
      request.onsuccess = () => {
        const record = request.result as CachedFollowRoute;
        const member = this.memberLogin.loggedInMember();
        resolve(record && routeVisibleToMember(record.payload, member) ? {...record, payload: {...record.payload,
          canEdit: record.payload.source === RouteFollowSource.OS_MAPS ? routeEditableByMember(record.payload, member) : record.payload.canEdit}} : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction(ROUTES_STORE, "readwrite").objectStore(ROUTES_STORE).delete(key);
      request.onsuccess = () => resolve();
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
      try {
        const record = await this.cached(key);
        if (record?.tilesReady) {
          return RouteFollowOfflineStatus.AVAILABLE;
        } else if (record) {
          return RouteFollowOfflineStatus.SAVING;
        } else {
          return RouteFollowOfflineStatus.NEEDS_NETWORK;
        }
      } catch (error) {
        this.logger.warn("route cache status unavailable", error);
        return RouteFollowOfflineStatus.NEEDS_NETWORK;
      }
    }
  }

  async summaries(): Promise<RouteFollowSummary[]> {
    const listed = await this.homeList();
    return listed.routes;
  }

  async homeList(): Promise<{
    routes: RouteFollowSummary[];
    previewPoints: Record<string, RouteFollowPoint[]>;
    offlineByKey: Record<string, RouteFollowOfflineStatus>;
  }> {
    const records = await this.allRoutesOrNone();
    return records.reduce((acc, record) => {
      const summary = this.summaryFrom(record);
      const key = followCacheKey(summary);
      return {
        routes: [...acc.routes, summary],
        previewPoints: key && summary.previewPoints && summary.previewPoints.length >= 2
          ? {...acc.previewPoints, [key]: summary.previewPoints}
          : acc.previewPoints,
        offlineByKey: key
          ? {...acc.offlineByKey, [key]: record.tilesReady ? RouteFollowOfflineStatus.AVAILABLE : RouteFollowOfflineStatus.SAVING}
          : acc.offlineByKey
      };
    }, {
      routes: [] as RouteFollowSummary[],
      previewPoints: {} as Record<string, RouteFollowPoint[]>,
      offlineByKey: {} as Record<string, RouteFollowOfflineStatus>
    });
  }

  async legacyRoutes(): Promise<LegacyWalkingRoute[]> {
    if (nativeWalkingSite()) {
      const records = await this.allRoutes(DB_NAME);
      const member = this.memberLogin.loggedInMember();
      return records.filter(record => routeVisibleToMember(record.payload, member)).map(record => ({...this.summaryFrom(record), key: record.key}));
    } else {
      return [];
    }
  }

  async restoreLegacyRoutes(keys: string[], site: string): Promise<string[]> {
    const records = await this.allRoutes(DB_NAME);
    const currentKeys = new Set((await this.allRoutes()).map(record => record.key));
    const member = this.memberLogin.loggedInMember();
    const selected = records.filter(record => keys.includes(record.key) && routeVisibleToMember(record.payload, member));
    return selected.reduce<Promise<string[]>>(async (pending, record) => {
      const restored = await pending;
      if (nativeWalkingSite() !== site) {
        throw new Error("The selected website changed during recovery. Try again on the correct site.");
      } else {
        if (!currentKeys.has(record.key)) {
          await this.putRoute(record);
        }
        return [...restored, record.key];
      }
    }, Promise.resolve([]));
  }

  private summaryFrom(record: CachedFollowRoute): RouteFollowSummary {
    return {
      source: record.payload.source,
      visibility: record.payload.visibility,
      ownerMemberId: record.payload.ownerMemberId,
      canEdit: record.payload.canEdit,
      title: record.payload.title,
      description: record.payload.description || null,
      createdDate: record.payload.createdDate, createdBy: record.payload.createdBy, createdByName: record.payload.createdByName,
      updatedDate: record.payload.updatedDate, updatedBy: record.payload.updatedBy, updatedByName: record.payload.updatedByName,
      path: record.payload.path,
      walkId: record.payload.walkId,
      routeId: record.payload.routeId,
      ramblersSlug: record.payload.ramblersSlug,
      osMapsRouteId: record.payload.osMapsRouteId,
      distanceMiles: record.payload.guide?.distance_miles || record.payload.totalMetres / 1609.34 || null,
      startDescription: record.payload.guide?.start_location?.description || record.payload.guide?.start_location?.postcode || null,
      startLatitude: record.payload.guide?.start_location?.latitude ?? record.payload.points?.[0]?.latitude ?? null,
      startLongitude: record.payload.guide?.start_location?.longitude ?? record.payload.points?.[0]?.longitude ?? null,
      previewPoints: record.payload.points?.length >= 2
        ? simplifiedRoutePoints(record.payload.points, ROUTE_PREVIEW_SPACING_METRES, ROUTE_PREVIEW_MAX_POINTS)
        : null
    };
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
      return (await this.allRoutes()).filter(record => routeVisibleToMember(record.payload, this.memberLogin.loggedInMember()));
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
        const response = await fetchFollowTile(url);
        if (!response.ok && response.type !== "opaque") {
          throw new Error(`Map tile request failed: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const next = {saved: acc.saved + 1, total: unique.length, bytes: acc.bytes + buffer.byteLength};
        if (onProgress) {
          onProgress(index + 1, unique.length, next.bytes);
        }
        return next;
      } catch (error) {
        this.logger.warn("map tile could not be saved", error);
        if (onProgress) {
          onProgress(index + 1, unique.length, acc.bytes);
        }
        return {...acc, total: unique.length};
      }
    }, Promise.resolve({saved: 0, total: unique.length, bytes: 0}));
    return result;
  }

  private async allRoutes(dbName = nativeWalkingStorageKey(DB_NAME)): Promise<CachedFollowRoute[]> {
    const db = await this.database(dbName);
    return new Promise((resolve, reject) => {
      const request = db.transaction(ROUTES_STORE, "readonly").objectStore(ROUTES_STORE).getAll();
      request.onsuccess = () => resolve(isArray(request.result) ? request.result as CachedFollowRoute[] : []);
      request.onerror = () => reject(request.error);
    });
  }

  private async putRoute(record: CachedFollowRoute): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ROUTES_STORE, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Route cache write was interrupted"));
      transaction.objectStore(ROUTES_STORE).put(record);
    });
  }

  private database(dbName = nativeWalkingStorageKey(DB_NAME)): Promise<IDBDatabase> {
    if (this.dbPromise && this.dbName === dbName) {
      return this.dbPromise;
    } else {
      this.dbName = dbName;
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
          const request = window.indexedDB.open(dbName, DB_VERSION);
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
