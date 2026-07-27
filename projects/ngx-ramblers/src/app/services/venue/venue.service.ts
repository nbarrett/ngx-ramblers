import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable } from "rxjs";
import { inferVenueTypeFromName, StoredVenue, Venue, VenueWithUsageStats } from "../../models/event-venue.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AddressQueryService } from "../walks/address-query.service";
import { DateUtilsService } from "../date-utils.service";
import { isEmpty, isString, isUndefined } from "es-toolkit/compat";
import { StoredVenueService } from "./stored-venue.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { LocationDetails } from "../../models/ramblers-walks-manager";

export enum VenueLocationSource {
  START_LOCATION = "start_location",
  LOCATION = "location"
}

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

  ensureVenue(event: ExtendedGroupEvent, options: {
    source?: VenueLocationSource;
    defaultVenuePublish?: boolean;
  } = {}): void {
    if (!event?.fields) {
      return;
    }
    const source = options.source || VenueLocationSource.START_LOCATION;
    const locationSource = source === VenueLocationSource.LOCATION
      ? event.groupEvent?.location
      : event.groupEvent?.start_location;
    if (!event.fields.venue) {
      event.fields.venue = {
        postcode: locationSource?.postcode || null,
        isMeetingPlace: false,
        venuePublish: options.defaultVenuePublish ?? false
      };
    } else {
      if (isUndefined(event.fields.venue.isMeetingPlace)) {
        event.fields.venue.isMeetingPlace = false;
      }
      if (isUndefined(event.fields.venue.venuePublish)) {
        event.fields.venue.venuePublish = options.defaultVenuePublish ?? false;
      }
    }
    if (source === VenueLocationSource.LOCATION && locationSource) {
      this.seedVenueFromLocation(event.fields.venue, locationSource);
    }
  }

  seedVenueFromLocation(venue: Venue, location: LocationDetails): void {
    if (!venue || !location) {
      return;
    }
    if (!venue.name && location.description) {
      venue.name = location.description;
    }
    if (!venue.postcode && location.postcode) {
      venue.postcode = location.postcode;
    }
    if (!venue.lat && location.latitude) {
      venue.lat = location.latitude;
    }
    if (!venue.lon && location.longitude) {
      venue.lon = location.longitude;
    }
  }

  syncGroupEventLocationFromVenue(event: ExtendedGroupEvent): void {
    if (!event?.groupEvent || !event?.fields?.venue) {
      return;
    }
    if (!event.groupEvent.location) {
      event.groupEvent.location = this.emptyLocation();
    }
    const venue = event.fields.venue;
    const location = event.groupEvent.location;
    location.description = this.locationDescriptionFromVenue(venue);
    location.postcode = venue.postcode || null;
    if (venue.lat) {
      location.latitude = venue.lat;
    }
    if (venue.lon) {
      location.longitude = venue.lon;
    }
  }

  locationDescriptionFromVenue(venue: Venue): string {
    const parts = [venue?.name, venue?.address1, venue?.address2].filter(part => !!part);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  emptyLocation(): LocationDetails {
    return {
      latitude: 0,
      longitude: 0,
      grid_reference_6: null,
      grid_reference_8: null,
      grid_reference_10: null,
      postcode: null,
      description: null,
      w3w: null
    };
  }

  async persistToCollection(venue: Venue): Promise<void> {
    if (!venue?.name) {
      return;
    }
    try {
      const storedVenue = await this.storedVenueService.findOrCreate({
        id: venue.storedVenueId,
        name: venue.name,
        postcode: venue.postcode,
        type: venue.type,
        url: venue.url,
        lat: venue.lat,
        lon: venue.lon,
        address1: venue.address1,
        address2: venue.address2
      });
      venue.storedVenueId = storedVenue.id;
      this.logger.debug("persistToCollection:venue persisted:", storedVenue);
    } catch (error) {
      this.logger.warn("persistToCollection:failed to persist venue:", error);
    }
  }
}
