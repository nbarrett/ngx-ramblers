import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import get from "lodash-es/get";
import has from "lodash-es/has";
import isEmpty from "lodash-es/isEmpty";
import last from "lodash-es/last";
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
import { DisplayedWalk, EventType, Walk } from "../models/walk.model";
import { ConfigService } from "./config.service";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { AlertInstance } from "./notifier.service";
import { StringUtilsService } from "./string-utils.service";


@Injectable({
  providedIn: "root"
})
export class MeetupService {
  private BASE_URL = "/api/meetup";
  private receivedEvents: MeetupEventResponse[] = [];
  private eventsUpdated = new Subject<MeetupEventResponse[]>();
  private logger: Logger;

  constructor(private dateUtils: DateUtilsService,
              private configService: ConfigService,
              private stringUtils: StringUtilsService,
              private http: HttpClient, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MeetupService, NgxLoggerLevel.OFF);
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

  getConfig(): Promise<MeetupConfig> {
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
        && displayedWalk.walk.walkDate > this.dateUtils.momentNowNoTime().valueOf()
        && has(displayedWalk.walk, ["config", "meetup"])
        && displayedWalk.walk.meetupPublish) {
        const eventExists: boolean = await this.eventExists(notify, displayedWalk.walk);
        if (eventExists) {
          return this.updateEvent(notify, displayedWalk.walk, meetupDescription);
        } else {
          return this.createEvent(notify, displayedWalk.walk, meetupDescription);
        }
      } else if (displayedWalk.walk.meetupEventUrl) {
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

  async deleteEvent(notify: AlertInstance, walk: Walk): Promise<boolean> {
    try {
      const eventDeletable = await this.eventDeletable(notify, walk);
      if (eventDeletable) {
        notify.progress({title: "Meetup", message: "Deleting existing event"});
        const eventId = this.eventIdFrom(walk);
        const apiResponse: ApiResponse = await this.http.delete<ApiResponse>(`${this.BASE_URL}/events/delete/${eventId}`).toPromise();
        this.logger.debug("delete event API response", apiResponse);
      }
      walk.meetupPublish = false;
      walk.meetupEventUrl = "";
      walk.meetupEventTitle = "";
      return eventDeletable;
    } catch (error) {
      return Promise.reject(`Event deletion failed: '${this.extractErrorsFrom(error)}'.`);
    }
  }

  async createEvent(notify: AlertInstance, walk: Walk, description: string): Promise<MeetupEventResponse> {
    try {
      notify.progress({title: "Meetup", message: "Creating new event"});
      const eventRequest = await this.eventRequestFor(notify, walk, description);
      const apiResponse = await this.http.post<ApiResponse>(`${this.BASE_URL}/events/create`, eventRequest).toPromise();
      this.logger.debug("create event API response", apiResponse);
      const eventResponse: MeetupEventResponse = apiResponse.response;
      walk.meetupEventUrl = eventResponse.link;
      walk.meetupEventTitle = eventResponse.title;
      return eventResponse;
    } catch (error) {
      return Promise.reject(`Event creation failed: '${this.extractErrorsFrom(error)}'.`);
    }
  }

  async createOrMatchVenue(notify: AlertInstance, walk: Walk): Promise<NumericIdentifier> {
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

  async updateEvent(notify: AlertInstance, walk: Walk, description: string): Promise<MeetupEventResponse> {
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

  async eventExists(notify: AlertInstance, walk: Walk): Promise<boolean> {
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

  async eventDeletable(notify: AlertInstance, walk: Walk): Promise<boolean> {
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

  async eventRequestFor(notify: AlertInstance, walk: Walk, description: string): Promise<MeetupEventRequest> {
    const venueResponse: NumericIdentifier = await this.createOrMatchVenue(notify, walk);
    this.logger.debug("venue for", walk.postcode, "is", venueResponse);

    const eventRequest = {
      venue_id: venueResponse.id,
      time: this.dateUtils.startTime(walk),
      duration: this.dateUtils.durationForDistance(walk.distance),
      guest_limit: walk.config.meetup.guestLimit,
      announce: walk.config.meetup.announce,
      venue_visibility: "public",
      publish_status: walk.config.meetup.publishStatus,
      name: walk.briefDescriptionAndStartPoint,
      description
    };
    this.logger.debug("request about to be submitted for walk is", eventRequest);
    return eventRequest;
  }

  venueRequestFor(walk: Walk): MeetupVenueRequest {
    const venueRequest: MeetupVenueRequest = {
      name: walk.venue.name || walk.briefDescriptionAndStartPoint,
      address_1: walk.venue.address1 || walk.nearestTown,
      city: walk.venue.postcode || walk.postcode,
      web_url: walk.venue.url,
      country: "gb",
    };
    if (walk.venue.address2) {
      venueRequest.address_2 = walk.venue.address2;
    }
    this.logger.debug("venue request prepared for walk is", venueRequest);
    return venueRequest;
  }

  meetupPublishedStatus(displayedWalk: DisplayedWalk) {
    return get(displayedWalk, ["walk", "config", "meetup", "publishStatus"]) || "";
  }

  private eventIdFrom(walk: Walk) {
    return walk.meetupEventUrl && last(walk.meetupEventUrl.split("/").filter(pathParameter => !isEmpty(pathParameter)));
  }

  private extractMatchedVenue(response: MeetupVenueConflictResponse): NumericIdentifier {
    return {id: response.errors[0].potential_matches[0].id};
  }

  private extractCreatedVenue(response: MeetupVenueResponse): NumericIdentifier {
    return {id: response.id};
  }
}
