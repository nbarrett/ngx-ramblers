import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../models/api-request.model";
import { ContactInteraction, ContactInteractionApiResponse } from "../models/booking.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ContactInteractionService {
  private logger: Logger = inject(LoggerFactory).createLogger("ContactInteractionService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/contact-interaction";
  private contactInteractionNotifications = new Subject<ContactInteractionApiResponse>();

  notifications(): Observable<ContactInteractionApiResponse> {
    return this.contactInteractionNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): void {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    this.commonDataService.responseFrom(this.logger, this.http.get<ContactInteractionApiResponse>(`${this.BASE_URL}/all`, {params}), this.contactInteractionNotifications);
  }

  async create(interaction: ContactInteraction): Promise<ContactInteraction> {
    this.logger.debug("creating", interaction);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ContactInteractionApiResponse>(this.BASE_URL, interaction), this.contactInteractionNotifications);
    this.logger.debug("created", interaction, "- received", apiResponse);
    return apiResponse.response as ContactInteraction;
  }

  async update(interaction: ContactInteraction): Promise<ContactInteraction> {
    this.logger.debug("updating", interaction);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ContactInteractionApiResponse>(`${this.BASE_URL}/${interaction.id}`, interaction), this.contactInteractionNotifications);
    this.logger.debug("updated", interaction, "- received", apiResponse);
    return apiResponse.response as ContactInteraction;
  }

  async delete(interaction: ContactInteraction): Promise<ContactInteraction> {
    this.logger.debug("deleting", interaction);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<ContactInteractionApiResponse>(`${this.BASE_URL}/${interaction.id}`), this.contactInteractionNotifications);
    this.logger.debug("deleted", interaction, "- received", apiResponse);
    return apiResponse.response as ContactInteraction;
  }
}
