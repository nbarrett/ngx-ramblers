import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import {
  BackupSession,
  BackupRequest,
  RestoreRequest,
  EnvironmentInfo,
  BackupListItem,
  BackupConfig,
  S3BackupRequest,
  S3RestoreRequest,
  S3BackupSummary,
  S3BackupManifest
} from "../models/backup-session.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { map } from "rxjs/operators";

import { NamedError } from "../models/api-response.model";

@Injectable({
  providedIn: "root"
})
export class BackupAndRestoreService {
  private logger: Logger = inject(LoggerFactory).createLogger("BackupAndRestoreService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private MONGO_BASE_URL = "api/mongo-backup";
  private S3_BASE_URL = "api/s3-backup";

  listEnvironments(): Observable<EnvironmentInfo[]> {
    this.logger.info("listEnvironments");
    return this.http.get<EnvironmentInfo[]>(`${this.MONGO_BASE_URL}/environments`);
  }

  listBackups(): Observable<BackupListItem[]> {
    this.logger.info("listBackups");
    return this.http.get<BackupListItem[]>(`${this.MONGO_BASE_URL}/backups`);
  }

  listSessions(limit?: number): Observable<BackupSession[]> {
    this.logger.info("listSessions", limit);
    const params = limit ? { limit: limit.toString() } : {};
    return this.http.get<BackupSession[]>(`${this.MONGO_BASE_URL}/sessions`, { params });
  }

  session(sessionId: string): Observable<BackupSession> {
    this.logger.info("session", sessionId);
    return this.http.get<BackupSession>(`${this.MONGO_BASE_URL}/sessions/${sessionId}`);
  }

  startBackup(request: BackupRequest): Observable<BackupSession> {
    this.logger.info("startBackup", request);
    return this.http.post<BackupSession>(`${this.MONGO_BASE_URL}/backup`, request);
  }

  startRestore(request: RestoreRequest): Observable<BackupSession> {
    this.logger.info("startRestore", request);
    return this.http.post<BackupSession>(`${this.MONGO_BASE_URL}/restore`, request);
  }

  initializeConfig(): Observable<BackupConfig> {
    this.logger.info("initializeConfig");
    return this.http.post<BackupConfig>(`${this.MONGO_BASE_URL}/initialize-config`, {});
  }

  listCollections(environment: string): Observable<string[]> {
    this.logger.info("listCollections", environment);
    const encoded = encodeURIComponent(environment);
    return this.http.get<string[]>(`${this.MONGO_BASE_URL}/environments/${encoded}/collections`);
  }

  listS3Backups(): Observable<BackupListItem[]> {
    const url = `${this.MONGO_BASE_URL}/s3/backups`;
    this.logger.info("listS3Backups", url);
    return this.http.get<BackupListItem[]>(url);
  }

  deleteS3Backups(names: string[]): Observable<{ deleted: string[]; errors: NamedError[] }> {
    this.logger.info("deleteS3Backups", names);
    return this.http.post<{ deleted: string[]; errors: NamedError[] }>(`${this.MONGO_BASE_URL}/backups/s3/delete`, { names });
  }

  deleteBackups(names: string[]): Observable<{ deleted: string[]; errors: NamedError[] }> {
    this.logger.info("deleteBackups", names);
    return this.http.post<{ deleted: string[]; errors: NamedError[] }>(`${this.MONGO_BASE_URL}/backups/delete`, { names });
  }

  startS3Backup(request: S3BackupRequest): Observable<S3BackupSummary[]> {
    this.logger.info("startS3Backup", request);
    return this.http.post<S3BackupSummary[]>(`${this.S3_BASE_URL}/backup`, request);
  }

  startS3Restore(request: S3RestoreRequest): Observable<S3BackupSummary[]> {
    this.logger.info("startS3Restore", request);
    return this.http.post<S3BackupSummary[]>(`${this.S3_BASE_URL}/restore`, request);
  }

  listS3Manifests(site?: string, limit?: number): Observable<S3BackupManifest[]> {
    this.logger.info("listS3Manifests", site, limit);
    const params: Record<string, string> = {};
    if (site) {
      params["site"] = site;
    }
    if (limit) {
      params["limit"] = limit.toString();
    }
    return this.http.get<S3BackupManifest[]>(`${this.S3_BASE_URL}/manifests`, { params });
  }

  s3Manifest(id: string): Observable<S3BackupManifest> {
    this.logger.info("s3Manifest", id);
    return this.http.get<S3BackupManifest>(`${this.S3_BASE_URL}/manifests/${id}`);
  }

  s3ManifestByTimestamp(site: string, timestamp: string): Observable<S3BackupManifest> {
    this.logger.info("s3ManifestByTimestamp", site, timestamp);
    return this.http.get<S3BackupManifest>(`${this.S3_BASE_URL}/manifests/${encodeURIComponent(site)}/${encodeURIComponent(timestamp)}`);
  }

  listS3Sites(): Observable<string[]> {
    this.logger.info("listS3Sites");
    return this.http.get<string[]>(`${this.S3_BASE_URL}/sites`);
  }

  deleteS3Manifests(ids: string[]): Observable<{ deleted: number; blocked: Array<{ id: string; reason: string }> }> {
    this.logger.info("deleteS3Manifests", ids);
    return this.http.post<{ deleted: number; blocked: Array<{ id: string; reason: string }> }>(`${this.S3_BASE_URL}/manifests/delete`, { ids });
  }
}
