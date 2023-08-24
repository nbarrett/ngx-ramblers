import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../models/api-response.model";
import { ConfigDocument, ConfigKey } from "../models/config.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class ConfigService {
  private BASE_URL = "/api/database/config";
  private logger: Logger;

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              private stringUtilsService: StringUtilsService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ConfigService", NgxLoggerLevel.OFF);
  }

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
