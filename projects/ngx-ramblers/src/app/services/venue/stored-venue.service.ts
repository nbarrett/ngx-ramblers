import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { StoredVenue, StoredVenueApiResponse, Venue } from "../../models/event-venue.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class StoredVenueService {

  private logger: Logger = inject(LoggerFactory).createLogger("StoredVenueService", NgxLoggerLevel.ERROR);
  private BASE_URL = "/api/database/venues";
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
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
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<StoredVenueApiResponse>(`${this.BASE_URL}`, venue),
      this.venueNotifications
    );
    return response.response as StoredVenue;
  }

  async update(venue: StoredVenue): Promise<StoredVenue> {
    this.logger.debug("update:", venue);
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.put<StoredVenueApiResponse>(`${this.BASE_URL}/${venue.id}`, venue),
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

  async findOrCreate(venue: Partial<Venue>): Promise<StoredVenue> {
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
}
