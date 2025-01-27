import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class HttpResponseService {

  private logger: Logger = inject(LoggerFactory).createLogger("HttpResponseService", NgxLoggerLevel.ERROR);

  returnResponse(response) {
    this.logger.debug("response.data:", response.data);
    return response.data;
  }

}
