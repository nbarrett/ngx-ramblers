import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DataQueryOptions } from "../../models/api-request.model";
import { MigrationHistory, MigrationHistoryApiResponse } from "../../models/migration-history.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({ providedIn: "root" })
export class MigrationHistoryService {
  private logger: Logger = inject(LoggerFactory).createLogger("MigrationHistoryService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private common = inject(CommonDataService);
  private BASE_URL = "/api/database/migration-history";

  async all(options?: DataQueryOptions): Promise<MigrationHistory[]> {
    const params = this.common.toHttpParams(options);
    const res = await this.common.responseFrom(this.logger, this.http.get<MigrationHistoryApiResponse>(`${this.BASE_URL}/all`, { params }));
    const items = (Array.isArray(res.response) ? res.response : [res.response]) as MigrationHistory[];
    return items.sort((a, b) => (b.createdDate || 0) - (a.createdDate || 0));
  }
}

