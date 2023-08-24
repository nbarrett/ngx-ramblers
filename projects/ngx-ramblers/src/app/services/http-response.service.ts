import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class HttpResponseService {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(HttpResponseService, NgxLoggerLevel.OFF);
  }

  returnResponse(response) {
    this.logger.debug("response.data:", response.data);
    return response.data;
  }

}
