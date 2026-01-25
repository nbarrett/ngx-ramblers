import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { inferVenueTypeFromName, VenueApiResponse, VenueWithUsageStats } from "../../models/event-venue.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AddressQueryService } from "../walks/address-query.service";
import { isEmpty, isString } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class VenueService {

  private logger: Logger = inject(LoggerFactory).createLogger("VenueService", NgxLoggerLevel.ERROR);
  private BASE_URL = "/api/database/group-event";
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private addressQueryService = inject(AddressQueryService);
  private venueNotifications = new Subject<VenueApiResponse>();
  private venuesCache$ = new BehaviorSubject<VenueWithUsageStats[]>([]);
  private loaded = false;
  private geocodingInProgress = false;

  venues(): Observable<VenueWithUsageStats[]> {
    if (!this.loaded) {
      this.refreshVenues();
    }
    return this.venuesCache$.asObservable();
  }

  async refreshVenues(): Promise<VenueWithUsageStats[]> {
    this.logger.info("refreshVenues: fetching venues from backend");
    const venues = await this.queryVenues();
    this.venuesCache$.next(venues);
    this.loaded = true;
    return venues;
  }

  async queryVenues(): Promise<VenueWithUsageStats[]> {
    this.logger.debug("queryVenues: fetching venues");
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<VenueApiResponse>(`${this.BASE_URL}/venues`),
      this.venueNotifications
    );
    const venues = (response.response || []).map(venue => ({
      ...venue,
      type: this.inferVenueType(venue.name)
    }));
    this.logger.info("queryVenues: received", venues.length, "venues");
    this.geocodeVenuesWithoutCoordinates(venues);
    return venues;
  }

  private async geocodeVenuesWithoutCoordinates(venues: VenueWithUsageStats[]): Promise<void> {
    if (this.geocodingInProgress) {
      return;
    }
    this.geocodingInProgress = true;
    const venuesNeedingCoords = venues.filter(v => v.postcode && (!v.lat || !v.lon)).slice(0, 10);
    this.logger.debug("geocodeVenuesWithoutCoordinates: processing", venuesNeedingCoords.length, "venues");

    for (const venue of venuesNeedingCoords) {
      try {
        const result = await this.addressQueryService.gridReferenceLookup(venue.postcode);
        if (result?.latlng?.lat && result?.latlng?.lng) {
          venue.lat = result.latlng.lat;
          venue.lon = result.latlng.lng;
          this.logger.debug("geocodeVenuesWithoutCoordinates: geocoded", venue.name, "to", venue.lat, venue.lon);
        }
      } catch (error) {
        this.logger.warn("geocodeVenuesWithoutCoordinates: failed for", venue.postcode, error);
      }
    }

    if (venuesNeedingCoords.length > 0) {
      this.venuesCache$.next([...venues]);
    }
    this.geocodingInProgress = false;
  }

  inferVenueType(name: string): string {
    return inferVenueTypeFromName(name);
  }

  searchVenues(term: string): VenueWithUsageStats[] {
    if (!term || term.length < 2) {
      return this.venuesCache$.value;
    }

    const normalizedTerm = term.toLowerCase().trim();
    const venues = this.venuesCache$.value;

    const scored = venues.map(venue => {
      const nameLower = (venue.name || "").toLowerCase();
      const address1Lower = (venue.address1 || "").toLowerCase();
      const postcodeLower = (venue.postcode || "").toLowerCase();

      let score = 0;

      if (nameLower === normalizedTerm) {
        score = 1000;
      } else if (nameLower.startsWith(normalizedTerm)) {
        score = 500;
      } else if (nameLower.includes(normalizedTerm)) {
        score = 200;
      } else if (address1Lower.includes(normalizedTerm)) {
        score = 100;
      } else if (postcodeLower.includes(normalizedTerm)) {
        score = 50;
      }

      if (score > 0) {
        score += venue.usageCount;
      }

      return { venue, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.venue);
  }

  normalizePostcode(postcode: string | null | undefined): string {
    if (!isString(postcode) || isEmpty(postcode)) {
      return "";
    }
    return postcode.toUpperCase().replace(/\s+/g, " ").trim();
  }
}
