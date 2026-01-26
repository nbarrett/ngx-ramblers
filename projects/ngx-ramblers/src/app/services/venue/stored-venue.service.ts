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

  async findByBaseUrl(url: string): Promise<StoredVenue | null> {
    const baseUrl = this.extractBaseUrl(url);
    if (!baseUrl) {
      return null;
    }
    this.logger.debug("findByBaseUrl:", baseUrl);
    const allVenues = await this.all();
    return allVenues.find(venue => {
      const venueBaseUrl = this.extractBaseUrl(venue.url);
      return venueBaseUrl && venueBaseUrl.toLowerCase() === baseUrl.toLowerCase();
    }) || null;
  }
}
