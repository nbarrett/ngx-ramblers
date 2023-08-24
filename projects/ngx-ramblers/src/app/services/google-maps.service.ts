import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsConfig } from "../models/walk.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class GoogleMapsService {

  private BASE_URL = "/api/google-maps/config";
  private logger: Logger;

  constructor(private http: HttpClient, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(GoogleMapsService, NgxLoggerLevel.OFF);
  }

  async getConfig(): Promise<GoogleMapsConfig> {
    const apiResponse = await this.http.get<GoogleMapsConfig>(this.BASE_URL).toPromise();
    this.logger.debug("query - received", apiResponse);
    return apiResponse;
  }

  public urlForPostcode(postcode:string){
    return `https://maps.google.co.uk/maps?q=${postcode}`;
  }

}
