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
  BackupConfig
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
  private BASE_URL = "api/backup";

  listEnvironments(): Observable<EnvironmentInfo[]> {
    this.logger.info("listEnvironments");
    return this.http.get<EnvironmentInfo[]>(`${this.BASE_URL}/environments`);
  }

  listBackups(): Observable<BackupListItem[]> {
    this.logger.info("listBackups");
    return this.http.get<BackupListItem[]>(`${this.BASE_URL}/backups`);
  }

  listSessions(limit?: number): Observable<BackupSession[]> {
    this.logger.info("listSessions", limit);
    const params = limit ? { limit: limit.toString() } : {};
    return this.http.get<BackupSession[]>(`${this.BASE_URL}/sessions`, { params });
  }

  session(sessionId: string): Observable<BackupSession> {
    this.logger.info("session", sessionId);
    return this.http.get<BackupSession>(`${this.BASE_URL}/sessions/${sessionId}`);
  }

  startBackup(request: BackupRequest): Observable<BackupSession> {
    this.logger.info("startBackup", request);
    return this.http.post<BackupSession>(`${this.BASE_URL}/backup`, request);
  }

  startRestore(request: RestoreRequest): Observable<BackupSession> {
    this.logger.info("startRestore", request);
    return this.http.post<BackupSession>(`${this.BASE_URL}/restore`, request);
  }

  initializeConfig(): Observable<BackupConfig> {
    this.logger.info("initializeConfig");
    return this.http.post<BackupConfig>(`${this.BASE_URL}/initialize-config`, {});
  }

  listCollections(environment: string): Observable<string[]> {
    this.logger.info("listCollections", environment);
    const encoded = encodeURIComponent(environment);
    return this.http.get<string[]>(`${this.BASE_URL}/environments/${encoded}/collections`);
  }

  listS3Backups(): Observable<BackupListItem[]> {
    const url = `api/backup/s3/backups`;
    this.logger.info("listS3Backups", url);
    return this.http.get<BackupListItem[]>(url);
  }

  deleteS3Backups(names: string[]): Observable<{ deleted: string[]; errors: NamedError[] }> {
    this.logger.info("deleteS3Backups", names);
    return this.http.post<{ deleted: string[]; errors: NamedError[] }>(`api/backup/backups/s3/delete`, { names });
  }

  deleteBackups(names: string[]): Observable<{ deleted: string[]; errors: NamedError[] }> {
    this.logger.info("deleteBackups", names);
    return this.http.post<{ deleted: string[]; errors: NamedError[] }>(`${this.BASE_URL}/backups/delete`, { names });
  }
}
