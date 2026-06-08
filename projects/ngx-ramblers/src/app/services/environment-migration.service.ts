import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { Logger, LoggerFactory } from "./logger-factory.service";
import {
  EnvironmentMigrationAudit,
  EnvironmentMigrationRequest,
  EnvironmentMigrationRotationRequest
} from "../models/environment-migration.model";

@Injectable({
  providedIn: "root"
})
export class EnvironmentMigrationService {
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentMigrationService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private BASE_URL = "api/environment-migration";

  private safeRequestSummary(request: EnvironmentMigrationRequest | EnvironmentMigrationRotationRequest): object {
    return {
      migrationId: "migrationId" in request ? request.migrationId : "",
      environment: "environment" in request ? request.environment : "",
      mode: "mode" in request ? request.mode : "",
      dryRun: "dryRun" in request ? request.dryRun : "",
      backupPath: "backupPath" in request ? request.backupPath : "",
      rotateCredentials: "rotateCredentials" in request ? request.rotateCredentials : "",
      targetMongo: {
        cluster: request.targetMongo?.cluster,
        db: request.targetMongo?.db,
        username: request.targetMongo?.username
      }
    };
  }

  history(limit?: number, environment?: string): Observable<EnvironmentMigrationAudit[]> {
    const params: Record<string, string> = {};
    if (limit) {
      params["limit"] = limit.toString();
    }
    if (environment) {
      params["environment"] = environment;
    }
    this.logger.info("history", params);
    return this.http.get<EnvironmentMigrationAudit[]>(`${this.BASE_URL}/history`, { params });
  }

  migration(migrationId: string): Observable<EnvironmentMigrationAudit> {
    this.logger.info("migration", migrationId);
    return this.http.get<EnvironmentMigrationAudit>(`${this.BASE_URL}/${encodeURIComponent(migrationId)}`);
  }

  planMongoOnlyMigration(request: EnvironmentMigrationRequest): Observable<EnvironmentMigrationAudit> {
    this.logger.info("planMongoOnlyMigration", this.safeRequestSummary(request));
    return this.http.post<EnvironmentMigrationAudit>(`${this.BASE_URL}/mongo/plan`, request);
  }

  executeMongoOnlyMigration(request: EnvironmentMigrationRequest): Observable<EnvironmentMigrationAudit> {
    this.logger.info("executeMongoOnlyMigration", this.safeRequestSummary(request));
    return this.http.post<EnvironmentMigrationAudit>(`${this.BASE_URL}/mongo/execute`, request);
  }

  rotateMongoCredentials(request: EnvironmentMigrationRotationRequest): Observable<EnvironmentMigrationAudit> {
    this.logger.info("rotateMongoCredentials", this.safeRequestSummary(request));
    return this.http.post<EnvironmentMigrationAudit>(`${this.BASE_URL}/mongo/rotate`, request);
  }
}
