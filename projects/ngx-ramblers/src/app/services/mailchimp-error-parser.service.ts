import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpErrorParserService {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpErrorParserService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);

  extractError(responseData): { error: string } {
    let error;
    if (responseData?.error || responseData?.errno) {
      error = {error: responseData};
    } else if (responseData?.errors?.length > 0) {
      error = {
        error: responseData.errors.map(error => this.stringUtils.stringifyObject(error)).join(", ")
      };
    } else {
      error = {error: undefined};
    }
    this.logger.debug("responseData:", responseData, "error:", error);
    return error;
  }

}
