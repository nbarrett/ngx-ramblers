import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { StoredVenue, StoredVenueApiResponse, Venue } from "../../models/event-venue.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { DateUtilsService } from "../date-utils.service";

@Injectable({
  providedIn: "root"
})
export class StoredVenueService {

  private logger: Logger = inject(LoggerFactory).createLogger("StoredVenueService", NgxLoggerLevel.ERROR);
  private BASE_URL = "/api/database/venues";
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private dateUtils = inject(DateUtilsService);
  private venueNotifications = new Subject<StoredVenueApiResponse>();

  async all(): Promise<StoredVenue[]> {
    this.logger.debug("all: fetching all venues");
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<StoredVenueApiResponse>(`${this.BASE_URL}/all`),
      this.venueNotifications
    );
    return response.response as StoredVenue[];
  }

  async findById(id: string): Promise<StoredVenue> {
    this.logger.debug("findById:", id);
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<StoredVenueApiResponse>(`${this.BASE_URL}/${id}`),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async create(venue: StoredVenue): Promise<StoredVenue> {
    this.logger.debug("create:", venue);
    const venueWithTimestamp: StoredVenue = {
      ...venue,
      createdAt: this.dateUtils.nowAsValue()
    };
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<StoredVenueApiResponse>(`${this.BASE_URL}`, venueWithTimestamp),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async update(venue: StoredVenue): Promise<StoredVenue> {
    this.logger.debug("update:", venue);
    const venueWithTimestamp: StoredVenue = {
      ...venue,
      updatedAt: this.dateUtils.nowAsValue()
    };
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.put<StoredVenueApiResponse>(`${this.BASE_URL}/${venue.id}`, venueWithTimestamp),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async delete(venue: StoredVenue): Promise<StoredVenue> {
    this.logger.debug("delete:", venue.id);
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.delete<StoredVenueApiResponse>(`${this.BASE_URL}/${venue.id}`),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async findOrCreate(venue: Partial<StoredVenue>): Promise<StoredVenue> {
    this.logger.debug("findOrCreate:", venue);
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<StoredVenueApiResponse>(`${this.BASE_URL}/find-or-create`, venue),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async updateCoordinates(id: string, lat: number, lon: number): Promise<StoredVenue> {
    this.logger.debug("updateCoordinates:", id, lat, lon);
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<StoredVenueApiResponse>(`${this.BASE_URL}/update-coordinates`, {id, lat, lon}),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  extractBaseUrl(url: string): string | null {
    if (!url?.trim()) {
      return null;
    }
    try {
      const parsed = new URL(url.trim());
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return null;
    }
  }

  normalizeUrlForComparison(url: string): string | null {
    if (!url?.trim()) {
      return null;
    }
    try {
      const parsed = new URL(url.trim());
      const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
      return `${parsed.protocol}//${parsed.host}${path}`.toLowerCase();
    } catch {
      return null;
    }
  }

  hasSignificantPath(url: string): boolean {
    if (!url?.trim()) {
      return false;
    }
    try {
      const parsed = new URL(url.trim());
      const path = parsed.pathname.replace(/\/+$/, "");
      return path.length > 0;
    } catch {
      return false;
    }
  }

  async findByUrl(url: string): Promise<StoredVenue | null> {
    const normalizedUrl = this.normalizeUrlForComparison(url);
    const baseUrl = this.extractBaseUrl(url);
    if (!normalizedUrl || !baseUrl) {
      return null;
    }

    const searchUrlHasPath = this.hasSignificantPath(url);
    this.logger.debug("findByUrl: searching for", normalizedUrl, "hasPath:", searchUrlHasPath);
    const allVenues = await this.all();

    const exactMatch = allVenues.find(venue => {
      const venueNormalizedUrl = this.normalizeUrlForComparison(venue.url);
      return venueNormalizedUrl && venueNormalizedUrl === normalizedUrl;
    });

    if (exactMatch) {
      this.logger.debug("findByUrl: exact match found", exactMatch.name);
      return exactMatch;
    }

    if (searchUrlHasPath) {
      this.logger.debug("findByUrl: search URL has path but no exact match found - returning null");
      return null;
    }

    const baseUrlMatches = allVenues.filter(venue => {
      const venueBaseUrl = this.extractBaseUrl(venue.url);
      return venueBaseUrl && venueBaseUrl.toLowerCase() === baseUrl.toLowerCase();
    });

    if (baseUrlMatches.length === 1) {
      this.logger.debug("findByUrl: single base URL match found", baseUrlMatches[0].name);
      return baseUrlMatches[0];
    }

    this.logger.debug("findByUrl: no match found");
    return null;
  }

  async findByBaseUrl(url: string): Promise<StoredVenue | null> {
    return this.findByUrl(url);
  }
}
