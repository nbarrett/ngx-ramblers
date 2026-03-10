import { HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { forEach as each, isObject } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { ApiResponse } from "../models/api-response.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})

export class CommonDataService {

  private logger: Logger = inject(LoggerFactory).createLogger("CommonDataService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);

  public async responseFrom<T extends ApiResponse>(logger: Logger, observable: Observable<T>, notifications?: Subject<T>, rejectOnError?: boolean): Promise<T> {
    const notificationSubject = notifications || new Subject<T>();
    try {
      const apiResponse = await firstValueFrom(observable);
      logger.debug("api response:", apiResponse);
      notificationSubject.next(apiResponse);
      if (rejectOnError && apiResponse.error) {
        return Promise.reject("Update failed due to error: " + this.stringUtils.stringifyObject(apiResponse.error));
      }
      return apiResponse;
    } catch (httpErrorResponse) {
      logger.error("http error response", httpErrorResponse);
      notificationSubject.next((httpErrorResponse as HttpErrorResponse).error);
      throw httpErrorResponse;
    }
  }

  public toHttpParams(criteria: object): HttpParams {
    let params = new HttpParams();
    each(criteria, (value, field) => {
      const paramValue = isObject(value) ? JSON.stringify(value) : value;
      params = params.set(field, paramValue);
      this.logger.off("query setting params field:", field, "value:", paramValue);
    });
    return params;
  }
}
