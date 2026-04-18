import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../models/api-request.model";
import {
  Booking,
  BookingApiResponse,
  BookingAttendeeListResponse,
  BookingCancelRequest,
  BookingCapacityResponse,
  BookingCreateRequest,
  BookingEligibility,
  BookingReminderDispatch
} from "../models/booking.model";
import { BookingEmailType } from "../models/booking-config.model";
import { TemplateRenderRequest } from "../models/mail.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class BookingService {
  private logger: Logger = inject(LoggerFactory).createLogger("BookingService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/booking";
  private bookingNotifications = new Subject<BookingApiResponse>();

  notifications(): Observable<BookingApiResponse> {
    return this.bookingNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): void {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    this.commonDataService.responseFrom(this.logger, this.http.get<BookingApiResponse>(`${this.BASE_URL}/all`, {params}), this.bookingNotifications);
  }

  async createOrUpdate(booking: Booking): Promise<Booking> {
    if (booking.id) {
      return this.update(booking);
    } else {
      return this.create(booking);
    }
  }

  async create(booking: Booking, eventLink: string | null = null): Promise<Booking> {
    const request: BookingCreateRequest = {booking, eventLink};
    this.logger.debug("creating", request);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<BookingApiResponse>(this.BASE_URL, request), this.bookingNotifications);
    this.logger.debug("created", request, "- received", apiResponse);
    return apiResponse.response as Booking;
  }

  async update(booking: Booking): Promise<Booking> {
    this.logger.debug("updating", booking);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<BookingApiResponse>(`${this.BASE_URL}/${booking.id}`, booking), this.bookingNotifications);
    this.logger.debug("updated", booking, "- received", apiResponse);
    return apiResponse.response as Booking;
  }

  async delete(booking: Booking): Promise<Booking> {
    this.logger.debug("deleting", booking);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<BookingApiResponse>(`${this.BASE_URL}/${booking.id}`), this.bookingNotifications);
    this.logger.debug("deleted", booking, "- received", apiResponse);
    return apiResponse.response as Booking;
  }

  async queryForEvent(eventId: string): Promise<Booking[]> {
    const dataQueryOptions: DataQueryOptions = {criteria: {eventId}};
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("queryForEvent:eventId", eventId, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<BookingApiResponse>(`${this.BASE_URL}/all`, {params}), this.bookingNotifications);
    return apiResponse.response as Booking[];
  }

  async publicCapacity(eventId: string): Promise<BookingCapacityResponse> {
    this.logger.debug("publicCapacity:eventId", eventId);
    const apiResponse = await firstValueFrom(this.http.get<{response: BookingCapacityResponse}>(`${this.BASE_URL}/capacity/${eventId}`));
    return apiResponse.response;
  }

  async eligibility(eventId: string): Promise<BookingEligibility> {
    this.logger.debug("eligibility:eventId", eventId);
    const apiResponse = await firstValueFrom(this.http.get<{response: BookingEligibility}>(`${this.BASE_URL}/eligibility/${eventId}`));
    return apiResponse.response;
  }

  async attendeesForEvent(eventId: string): Promise<BookingAttendeeListResponse> {
    this.logger.debug("attendeesForEvent:eventId", eventId);
    const apiResponse = await firstValueFrom(this.http.get<{response: BookingAttendeeListResponse}>(`${this.BASE_URL}/attendees/${eventId}`));
    return apiResponse.response;
  }

  async sendReminders(eventId: string): Promise<BookingReminderDispatch> {
    this.logger.debug("sendReminders:eventId", eventId);
    const apiResponse = await firstValueFrom(this.http.post<{response: BookingReminderDispatch}>(`${this.BASE_URL}/send-reminders/${eventId}`, {}));
    return apiResponse.response;
  }

  async sendEmailsByType(eventId: string, emailType: BookingEmailType): Promise<BookingReminderDispatch> {
    this.logger.debug("sendEmailsByType:eventId", eventId, "emailType", emailType);
    const apiResponse = await firstValueFrom(this.http.post<{response: BookingReminderDispatch}>(`${this.BASE_URL}/send-emails/${emailType}/${eventId}`, {}));
    return apiResponse.response;
  }

  async previewEmail(eventId: string, emailType: BookingEmailType): Promise<TemplateRenderRequest> {
    this.logger.debug("previewEmail:eventId", eventId, "emailType", emailType);
    const apiResponse = await firstValueFrom(this.http.get<{response: TemplateRenderRequest}>(`${this.BASE_URL}/preview-email/${emailType}/${eventId}`));
    return apiResponse.response;
  }

  async lookupByEmail(eventId: string, email: string): Promise<Booking[]> {
    this.logger.debug("lookupByEmail:eventId", eventId, "email", email);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<BookingApiResponse>(`${this.BASE_URL}/lookup`, {eventId, email}), this.bookingNotifications);
    return apiResponse.response as Booking[];
  }

  async cancel(bookingId: string, email: string, eventLink: string | null = null): Promise<Booking> {
    const request: BookingCancelRequest = {email, eventLink};
    this.logger.debug("cancel:bookingId", bookingId, "request", request);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<BookingApiResponse>(`${this.BASE_URL}/cancel/${bookingId}`, request), this.bookingNotifications);
    return apiResponse.response as Booking;
  }
}
