import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { GridReferenceLookupApiResponse, GridReferenceLookupResponse } from "../../models/address-model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LatLng, LatLngLiteral } from "leaflet";

@Injectable({
  providedIn: "root"
})
export class AddressQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("AddressQueryService", NgxLoggerLevel.ERROR);
  private BASE_URL = "/api/addresses";
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private postcodeNotifications = new Subject<GridReferenceLookupApiResponse>();

  private toLatLngLiteral(latlng: LatLng): LatLngLiteral {
    return {
      lat: latlng.lat,
      lng: latlng.lng
    };
  }

  async gridReferenceLookup(postcode: string): Promise<GridReferenceLookupResponse> {
    const params = this.commonDataService.toHttpParams({postcode});
    this.logger.debug("postcodeLookup:postcode", postcode, "params:", params.toString());
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<GridReferenceLookupApiResponse>(`${this.BASE_URL}/postcodes`, {params}), this.postcodeNotifications);
    return response.response as GridReferenceLookupResponse;
  }

  async gridReferenceLookupFromLatLng(latlng: LatLng): Promise<GridReferenceLookupResponse[]> {
    const body: LatLngLiteral = this.toLatLngLiteral(latlng);
    this.logger.info("reverseGeocode:body", body);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<GridReferenceLookupApiResponse>(`${this.BASE_URL}/reverse-geocode`, body), this.postcodeNotifications);
    return response.response as GridReferenceLookupResponse[];
  }

  async placeNameLookup(query: string): Promise<GridReferenceLookupResponse> {
    const params = this.commonDataService.toHttpParams({query});
    this.logger.info("placeNameLookup:query", query);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<GridReferenceLookupApiResponse>(`${this.BASE_URL}/place-names`, {params}), this.postcodeNotifications);
    this.logger.info("placeNameLookup:response", response);
    return response.response as GridReferenceLookupResponse;
  }

  async venueSearch(query: string, lat?: number, lon?: number): Promise<VenueSearchResult[]> {
    const params: Record<string, string> = { q: query };
    if (lat !== undefined && lon !== undefined) {
      params.lat = lat.toString();
      params.lon = lon.toString();
    }
    this.logger.info("venueSearch:query", query, "lat", lat, "lon", lon);
    const httpParams = this.commonDataService.toHttpParams(params);
    const response = await this.http.get<VenueSearchResponse>(`${this.BASE_URL}/venue-search`, { params: httpParams }).toPromise();
    this.logger.info("venueSearch:response", response);
    return response?.results || [];
  }

}

export interface VenueSearchResult {
  name: string;
  address1: string | null;
  address2: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
  type: string;
  source: "google";
  displayName: string;
  url: string | null;
}

export interface VenueSearchResponse {
  query: string;
  results: VenueSearchResult[];
}
