import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { isNumber } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { LatLngLiteral } from "leaflet";
import { DrivingDistanceResponse, GoogleMapsConfig } from "../models/walk.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class GoogleMapsService {

  private logger: Logger = inject(LoggerFactory).createLogger("GoogleMapsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private sanitiser = inject(DomSanitizer);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/google-maps";
  private subject = new ReplaySubject<GoogleMapsConfig>();
  private googleMapsConfig: GoogleMapsConfig = {apiKey: ""};

  constructor() {
    this.refreshConfig();
  }

  public events(): Observable<GoogleMapsConfig> {
    return this.subject.pipe(shareReplay());
  }

  async refreshConfig(): Promise<GoogleMapsConfig> {
    const apiResponse = await this.http.get<GoogleMapsConfig>(`${this.BASE_URL}/config`).toPromise();
    this.logger.debug("query - received", apiResponse);
    this.googleMapsConfig = apiResponse;
    this.subject.next(apiResponse);
    return apiResponse;
  }

  public urlForPostcode(postcode: string) {
    return `https://maps.google.co.uk/maps?q=${postcode}`;
  }

  public directionsEmbedUrl(origin: string, destination: string): SafeResourceUrl | null {
    const from = origin?.trim();
    const to = destination?.trim();
    if (this.googleMapsConfig?.apiKey && from && to) {
      return this.sanitiser.bypassSecurityTrustResourceUrl(
        `https://www.google.com/maps/embed/v1/directions?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&mode=driving&region=UK&key=${this.googleMapsConfig.apiKey}`
      );
    } else {
      return null;
    }
  }

  async drivingDistanceMiles(from: string, to: string, fromLatLng?: LatLngLiteral | null, toLatLng?: LatLngLiteral | null): Promise<number | null> {
    const params = this.commonDataService.toHttpParams({
      from,
      to,
      ...(fromLatLng ? {fromLat: fromLatLng.lat, fromLng: fromLatLng.lng} : {}),
      ...(toLatLng ? {toLat: toLatLng.lat, toLng: toLatLng.lng} : {})
    });
    const apiResponse = await firstValueFrom(
      this.http.get<DrivingDistanceResponse>(`${this.BASE_URL}/driving-distance`, {params})
    );
    this.logger.debug("drivingDistanceMiles:", from, to, fromLatLng, toLatLng, apiResponse);
    return isNumber(apiResponse?.miles) ? apiResponse.miles : null;
  }

}
