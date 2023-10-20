import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsConfig } from "../models/walk.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";

@Injectable({
  providedIn: "root"
})
export class GoogleMapsService {

  private BASE_URL = "/api/google-maps/config";
  private logger: Logger;
  private subject = new ReplaySubject<GoogleMapsConfig>();

  constructor(private http: HttpClient, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(GoogleMapsService, NgxLoggerLevel.OFF);
    this.refreshConfig();
  }

  public events(): Observable<GoogleMapsConfig> {
    return this.subject.pipe(shareReplay());
  }

  async refreshConfig(): Promise<GoogleMapsConfig> {
    const apiResponse = await this.http.get<GoogleMapsConfig>(this.BASE_URL).toPromise();
    this.logger.debug("query - received", apiResponse);
    this.subject.next(apiResponse);
    return apiResponse;
  }

  public urlForPostcode(postcode: string) {
    return `https://maps.google.co.uk/maps?q=${postcode}`;
  }

}
