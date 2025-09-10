import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { has } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { ApiResponse } from "../models/api-response.model";
import { ConfigKey } from "../models/config.model";
import { NumericIdentifier } from "../models/generic-response.model";
import { MeetupConfig, MeetupStatus } from "../models/meetup-config.model";
import { MeetupErrorResponse } from "../models/meetup-error-response.model";
import { MeetupEventDetailedResponse } from "../models/meetup-event-detailed-response.model";
import { MeetupEventRequest } from "../models/meetup-event-request.model";
import { MeetupEventResponse } from "../models/meetup-event-response.model";
import { MeetupLocationResponse } from "../models/meetup-location-response.model";
import { MeetupVenueRequest } from "../models/meetup-venue-request.model";
import { MeetupVenueConflictResponse, MeetupVenueResponse } from "../models/meetup-venue-response.model";
import { DisplayedWalk, EventType, LinkSource, LinkWithSource } from "../models/walk.model";
import { ConfigService } from "./config.service";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { AlertInstance } from "./notifier.service";
import { StringUtilsService } from "./string-utils.service";
import { CommonDataService } from "./common-data-service";
import {
  MeetupAuthRefreshToken,
  MeetupAuthRefreshTokenApiResponse,
  MeetupRequestAuthorisationApiResponse,
  MeetupRequestAuthorisationResponse
} from "../models/meetup-authorisation.model";
import { WalksConfigService } from "./system/walks-config.service";
import { WalksConfig } from "../models/walk-notification.model";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { LinksService } from "./links.service";

@Injectable({
  providedIn: "root"
})
export class MeetupService {

  private logger: Logger = inject(LoggerFactory).createLogger("MeetupService", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private walksConfigService = inject(WalksConfigService);
  private configService = inject(ConfigService);
  private linksService = inject(LinksService);
  private stringUtils = inject(StringUtilsService);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/meetup";
  private receivedEvents: MeetupEventResponse[] = [];
  private eventsUpdated = new Subject<MeetupEventResponse[]>();
  private walksConfig: WalksConfig;

  constructor() {
    this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.logger.info("walksConfigService:walksConfig:", walksConfig);
    });
  }

  saveConfig(notify: AlertInstance, config: MeetupConfig): Promise<void> {
    return this.configService.saveConfig<MeetupConfig>(ConfigKey.MEETUP, config)
      .then(() => {
        notify.success({
          title: "Meetup config",
          message: "Saved successfully"
        });
      })
      .catch((error) => {
        notify.error({
          title: "Meetup config",
          message: error
        });
      });
  }

  queryConfig(): Promise<MeetupConfig> {
    return this.configService.queryConfig<MeetupConfig>(ConfigKey.MEETUP, {
      defaultContent: null,
      publishStatus: MeetupStatus.DRAFT,
      guestLimit: 8,
      announce: false
    });
  }

  isMeetupErrorResponse(message: MeetupEventResponse[] | MeetupErrorResponse): message is MeetupErrorResponse {
    return message && (message as MeetupErrorResponse).status !== undefined;
  }

  publishStatuses(): string[] {
    return [MeetupStatus.DRAFT.toString(), MeetupStatus.PUBLISHED.toString()];
  }

  eventStatuses(): string[] {
    return Object.keys(MeetupStatus).map(k => MeetupStatus[k as any]);
  }

  location(query?: string): Observable<MeetupLocationResponse> {
    const queryParams = `?query=${query}`;
    return this.http
      .get<ApiResponse>(
        `${this.BASE_URL}/locations${queryParams}`
      ).pipe(
        mergeMap(apiResponse => {
          this.logger.debug("events API response", apiResponse);
          return apiResponse.response;
        })
      ) as Observable<MeetupLocationResponse>;
  }

  eventsForStatus(status?: string) {
    const queriedStatus = status || MeetupStatus.UPCOMING;
    const queryParams = `?status=${queriedStatus}`;
    this.http
      .get<ApiResponse>(
        `${this.BASE_URL}/events${queryParams}`
      )
      .subscribe(apiResponse => {
        this.logger.debug("events API response", apiResponse);
        this.receivedEvents = apiResponse.response;
        this.eventsUpdated.next([...this.receivedEvents]);
      });
  }

  eventsListener(): Observable<MeetupEventResponse[]> {
    return this.eventsUpdated.asObservable();
  }

  async synchroniseWalkWithEvent(notify: AlertInstance, displayedWalk: DisplayedWalk, meetupDescription: string): Promise<any> {
    try {
      if (displayedWalk.status === EventType.APPROVED
        && this.dateUtils.asDateTime(displayedWalk.walk?.groupEvent?.start_date_time).toMillis() > this.dateUtils.dateTimeNowNoTime().toMillis()
        && displayedWalk.walk.fields?.meetup
        && displayedWalk.walk.fields?.publishing?.meetup?.publish) {
        const eventExists: boolean = await this.eventExists(notify, displayedWalk.walk);
        if (eventExists) {
          return this.updateEvent(notify, displayedWalk.walk, meetupDescription);
        } else {
          return this.createEvent(notify, displayedWalk.walk, meetupDescription);
        }
      } else if (this.meetupLink(displayedWalk.walk)) {
        return this.deleteEvent(notify, displayedWalk.walk);
      } else {
        const reason = "no action taken as meetupPublish was false and walk had no existing publish status";
        this.logger.debug(reason);
        return Promise.resolve(reason);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async deleteEvent(notify: AlertInstance, walk: ExtendedGroupEvent): Promise<boolean> {
    try {
      const eventDeletable = await this.eventDeletable(notify, walk);
      if (eventDeletable) {
        notify.progress({title: "Meetup", message: "Deleting existing event"});
        const eventId = this.eventIdFrom(walk);
        const apiResponse: ApiResponse = await this.http.delete<ApiResponse>(`${this.BASE_URL}/events/delete/${eventId}`).toPromise();
        this.logger.debug("delete event API response", apiResponse);
      }
      walk.fields.publishing.meetup.publish = false;
      this.deleteLink(walk, LinkSource.MEETUP);
      return eventDeletable;
    } catch (error) {
      return Promise.reject(`Event deletion failed: '${this.extractErrorsFrom(error)}'.`);
    }
  }

  private deleteLink(walk: ExtendedGroupEvent, linkSource: LinkSource.MEETUP) {
    walk.fields.links = walk.fields.links.filter(item => item.source !== linkSource);
  }

  async createEvent(notify: AlertInstance, walk: ExtendedGroupEvent, description: string): Promise<MeetupEventResponse> {
    try {
      notify.progress({title: "Meetup", message: "Creating new event"});
      const eventRequest = await this.eventRequestFor(notify, walk, description);
      const apiResponse = await this.http.post<ApiResponse>(`${this.BASE_URL}/events/create`, eventRequest).toPromise();
      this.logger.debug("create event API response", apiResponse);
      const eventResponse: MeetupEventResponse = apiResponse.response;
      const linkWithSource: LinkWithSource = {
        source: LinkSource.MEETUP,
        href: eventResponse.link,
        title: eventResponse.title
      };
      this.linksService.createOrUpdateLink(walk.fields, linkWithSource);
      return eventResponse;
    } catch (error) {
      return Promise.reject(`Event creation failed: '${this.extractErrorsFrom(error)}'.`);
    }
  }

  async createOrMatchVenue(notify: AlertInstance, walk: ExtendedGroupEvent): Promise<NumericIdentifier> {
    notify.progress({title: "Meetup", message: "Creating new venue"});
    const venueRequest = this.venueRequestFor(walk);
    try {
      const createResponse = await this.http.post<ApiResponse>(`${this.BASE_URL}/venues/create`, venueRequest).toPromise();
      this.logger.debug("create venue API response", createResponse);
      if (createResponse.apiStatusCode === 409) {
        return this.extractMatchedVenue(createResponse.response);
      } else {
        return this.extractCreatedVenue(createResponse.response);
      }
    } catch (error) {
      return Promise.reject(`Venue request '${this.stringUtils.stringifyObject(venueRequest)}' was rejected by Meetup due to: '${this.extractErrorsFrom(error)}'. Try completing more venue details, or disable Meetup publishing.`);
    }
  }

  extractErrorsFrom(httpErrorResponse: any): string {
    this.logger.debug("api response was", httpErrorResponse);
    if (has(httpErrorResponse, ["error", "response", "errors"])) {
      return httpErrorResponse.error.response.errors.map(error => this.stringUtils.stringifyObject(error));
    }
    if (has(httpErrorResponse, ["error"])) {
      return this.stringUtils.stringifyObject(httpErrorResponse.error);
    }
    return httpErrorResponse;
  }

  async updateEvent(notify: AlertInstance, walk: ExtendedGroupEvent, description: string): Promise<MeetupEventResponse> {
    try {
      notify.progress({title: "Meetup", message: "Updating existing event"});
      this.logger.debug("updateEvent for", walk);
      const request = await this.eventRequestFor(notify, walk, description);
      const eventId = this.eventIdFrom(walk);
      const apiResponse = await this.http.patch<ApiResponse>(`${this.BASE_URL}/events/update/${eventId}`, request).toPromise();
      this.logger.debug("event update response for event id", eventId, "is", apiResponse);
      return apiResponse.response;
    } catch (error) {
      return Promise.reject(`Event update failed: '${this.extractErrorsFrom(error)}'.`);
    }
  }

  async eventExists(notify: AlertInstance, walk: ExtendedGroupEvent): Promise<boolean> {
    notify.progress({title: "Meetup", message: "Checking for existence of event"});
    const eventId = this.eventIdFrom(walk);
    if (eventId) {
      const apiResponse = await this.http.get<ApiResponse>(`${this.BASE_URL}/events/${eventId}`).toPromise();
      this.logger.debug("event query response for event id", eventId, "is", apiResponse);
      return apiResponse.apiStatusCode === 200;
    } else {
      return false;
    }
  }

  async eventDeletable(notify: AlertInstance, walk: ExtendedGroupEvent): Promise<boolean> {
    notify.progress({title: "Meetup", message: "Checking whether event can be deleted"});
    const eventId = this.eventIdFrom(walk);
    if (eventId) {
      const apiResponse = await this.http.get<ApiResponse>(`${this.BASE_URL}/events/${eventId}`).toPromise();
      this.logger.debug("event query response for event id", eventId, "is", apiResponse);
      if (apiResponse.apiStatusCode === 200) {
        const event: MeetupEventDetailedResponse = apiResponse.response;
        return event.status !== MeetupStatus.PAST;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async eventRequestFor(notify: AlertInstance, walk: ExtendedGroupEvent, description: string): Promise<MeetupEventRequest> {
    const venueResponse: NumericIdentifier = await this.createOrMatchVenue(notify, walk);
    this.logger.debug("venue for", walk?.groupEvent?.start_location?.postcode, "is", venueResponse);

    const eventRequest = {
      venue_id: venueResponse.id,
      time: this.dateUtils.startTimeAsValue(walk),
      duration: this.dateUtils.durationInMsecsForDistanceInMiles(walk?.groupEvent?.distance_miles, this.walksConfig.milesPerHour),
      guest_limit: walk.fields.meetup.guestLimit,
      announce: walk.fields.meetup.announce,
      venue_visibility: "public",
      publish_status: walk.fields.meetup.publishStatus,
      name: walk?.groupEvent?.title,
      description
    };
    this.logger.debug("request about to be submitted for walk is", eventRequest);
    return eventRequest;
  }

  venueRequestFor(walk: ExtendedGroupEvent): MeetupVenueRequest {
    const venueRequest: MeetupVenueRequest = {
      name: walk.fields.venue.name || walk?.groupEvent?.title,
      address_1: walk.fields.venue.address1 || walk?.groupEvent?.start_location?.description,
      city: walk.fields.venue.postcode || walk.groupEvent.start_location?.postcode,
      web_url: walk.fields.venue.url,
      country: "gb",
    };
    if (walk.fields.venue.address2) {
      venueRequest.address_2 = walk.fields.venue.address2;
    }
    this.logger.debug("venue request prepared for walk is", venueRequest);
    return venueRequest;
  }

  meetupPublishedStatus(displayedWalk: DisplayedWalk): string {
    return displayedWalk?.walk?.fields?.meetup?.publishStatus || "";
  }

  private eventIdFrom(walk: ExtendedGroupEvent): string {
    return this.stringUtils.lastItemFrom(this.meetupLink(walk)?.href);
  }

  private meetupLink(walk: ExtendedGroupEvent): LinkWithSource {
    return this.linksService.linkWithSourceFrom(walk.fields, LinkSource.MEETUP);
  }

  private extractMatchedVenue(response: MeetupVenueConflictResponse): NumericIdentifier {
    return {id: response.errors[0].potential_matches[0].id};
  }

  private extractCreatedVenue(response: MeetupVenueResponse): NumericIdentifier {
    return {id: response.id};
  }

  async requestAuthorisation(): Promise<MeetupRequestAuthorisationResponse> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<MeetupRequestAuthorisationApiResponse>(`${this.BASE_URL}/request-authorisation-url`))).response;
  }

  async requestAccess(meetupAccessCode: string): Promise<MeetupAuthRefreshToken> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<MeetupAuthRefreshTokenApiResponse>(`${this.BASE_URL}/request-access?code=${meetupAccessCode}`, null))).response;
  }

  async refreshToken(refreshToken: string): Promise<MeetupAuthRefreshToken> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<MeetupAuthRefreshTokenApiResponse>(`${this.BASE_URL}/refresh-token?refreshToken=${refreshToken}`, null))).response;
  }

}
