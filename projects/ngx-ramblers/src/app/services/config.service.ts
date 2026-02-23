import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../models/api-response.model";
import { ConfigDocument, ConfigKey } from "../models/config.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("ConfigService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/config";

  private async queryApiForKey<T>(key: ConfigKey): Promise<T> {
    const criteria = {key};
    this.logger.info("query:criteria", JSON.stringify(criteria));
    const params = this.commonDataService.toHttpParams(criteria);
    this.logger.info("query:params", params);
    const apiResponse = await this.http.get<ApiResponse>(this.BASE_URL, {params}).toPromise();
    this.logger.info("query - received", apiResponse);
    return apiResponse.response;
  }

  queryConfig<T>(key: ConfigKey, defaultOnEmpty?: T): Promise<T> {
    return this.queryApiForKey<T>(key)
      .then((configDocument) => {
        if (configDocument) {
          this.logger.info("getConfig:", key, "existing configDocument", configDocument);
          return configDocument;
        } else {
          const result = defaultOnEmpty;
          this.logger.info("getConfig:", key, "defaultOnEmpty:", defaultOnEmpty, "new configDocument", result);
          return result;
        }
      }).catch(error => {
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.logger.debug(`Query of ${key} config returned 403 - user not authenticated, returning default`);
          return defaultOnEmpty;
        }
        this.logger.error(`Query of ${key} config failed:`, error);
        return Promise.reject(`Query of ${key} config failed: ${error}`);
      });
  }

  async saveConfig<T>(key: ConfigKey, value: T): Promise<T> {
    const configDocument: ConfigDocument = {key, value};
    this.logger.debug("saveConfig:", configDocument);
    const apiResponse = await this.http.post<{ response: any }>(this.BASE_URL, configDocument).toPromise();
    this.logger.debug("created", value, "received:", apiResponse);
    return apiResponse.response;
  }

}
