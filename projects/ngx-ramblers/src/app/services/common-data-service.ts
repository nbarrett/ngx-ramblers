import { HttpErrorResponse, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import each from "lodash-es/each";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { share } from "rxjs/operators";
import { ApiResponse } from "../models/api-response.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})

export class CommonDataService {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory, private stringUtils: StringUtilsService) {
    this.logger = loggerFactory.createLogger("CommonDataService", NgxLoggerLevel.OFF);
  }

  public async responseFrom<T extends ApiResponse>(logger: Logger, observable: Observable<T>, notifications: Subject<T>, rejectOnError?: boolean): Promise<T> {
    const shared = observable.pipe(share());
    shared.subscribe((apiResponse: T) => {
      logger.debug("api response:", apiResponse);
      notifications.next(apiResponse);
    }, (httpErrorResponse: HttpErrorResponse) => {
      logger.error("http error response", httpErrorResponse);
      notifications.next(httpErrorResponse.error);
    });
    const apiResponse = await shared.toPromise();
    return rejectOnError && apiResponse.error ? Promise.reject("Update failed due to error: " + this.stringUtils.stringifyObject(apiResponse.error)) : apiResponse;
  }

  public toHttpParams(criteria: object): HttpParams {
    let params = new HttpParams();
    each(criteria, (value, field) => {
      const paramValue = typeof value === "object" ? JSON.stringify(value) : value;
      params = params.set(field, paramValue);
      this.logger.off("query setting params field:", field, "value:", paramValue);
    });
    return params;
  }
}
