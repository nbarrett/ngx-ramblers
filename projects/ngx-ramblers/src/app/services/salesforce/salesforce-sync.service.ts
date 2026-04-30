import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import {
  SalesforceConfig,
  SalesforceSyncApiResponse,
  SalesforceTestConnectionResult
} from "../../models/salesforce.model";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class SalesforceSyncService {

  private logger: Logger = inject(LoggerFactory).createLogger("SalesforceSyncService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private BASE_URL = "/api/salesforce";

  testConnection(config?: SalesforceConfig, groupCode?: string): Promise<SalesforceTestConnectionResult> {
    const body = {
      ...(config ? { config } : {}),
      ...(groupCode ? { groupCode } : {}),
    };
    this.logger.info("testConnection:", body);
    return this.http.post<SalesforceTestConnectionResult>(`${this.BASE_URL}/test-connection`, body).toPromise();
  }

  sync(fullSync: boolean): Promise<SalesforceSyncApiResponse> {
    this.logger.info("sync:fullSync=", fullSync);
    return this.http.post<SalesforceSyncApiResponse>(`${this.BASE_URL}/sync`, { fullSync }).toPromise();
  }
}
