import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable } from "rxjs";
import { inferVenueTypeFromName, StoredVenue, VenueWithUsageStats } from "../../models/event-venue.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AddressQueryService } from "../walks/address-query.service";
import { DateUtilsService } from "../date-utils.service";
import { isEmpty, isString } from "es-toolkit/compat";
import { StoredVenueService } from "./stored-venue.service";

@Injectable({
  providedIn: "root"
})
export class VenueService {

  private logger: Logger = inject(LoggerFactory).createLogger("VenueService", NgxLoggerLevel.ERROR);
  private storedVenueService = inject(StoredVenueService);
  private addressQueryService = inject(AddressQueryService);
  private dateUtils = inject(DateUtilsService);
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
    this.logger.debug("queryVenues: fetching venues from stored venues collection");
    const storedVenues: StoredVenue[] = await this.storedVenueService.all();
    const venues: VenueWithUsageStats[] = storedVenues.map(venue => ({
      storedVenueId: venue.id,
      name: venue.name,
      address1: venue.address1,
      address2: venue.address2,
      postcode: venue.postcode,
      type: venue.type || this.inferVenueType(venue.name),
      url: venue.url,
      lat: venue.lat,
      lon: venue.lon,
      usageCount: venue.usageCount || 0,
      lastUsed: venue.lastUsed ? this.dateUtils.isoDateTime(venue.lastUsed) : undefined,
      ngSelectLabel: this.buildNgSelectLabel(venue)
    }));
    this.logger.info("queryVenues: received", venues.length, "venues");
    this.geocodeVenuesWithoutCoordinates(venues);
    return venues;
  }

  private buildNgSelectLabel(venue: StoredVenue): string {
    const parts = [venue.name];
    if (venue.address1) parts.push(venue.address1);
    if (venue.postcode) parts.push(venue.postcode);
    return parts.join(", ");
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

  venueLabel(isMeetingPlace: boolean): string {
    return isMeetingPlace ? "Meeting place" : "Venue";
  }
}
