import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { VenueApiResponse, VenueWithUsageStats } from "../../models/event-venue.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { isEmpty, isString } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class VenueService {

  private logger: Logger = inject(LoggerFactory).createLogger("VenueService", NgxLoggerLevel.ERROR);
  private BASE_URL = "/api/database/group-event";
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private venueNotifications = new Subject<VenueApiResponse>();
  private venuesCache$ = new BehaviorSubject<VenueWithUsageStats[]>([]);
  private loaded = false;

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
    this.logger.info("queryVenues: received", response.response?.length || 0, "venues");
    return response.response as VenueWithUsageStats[];
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
