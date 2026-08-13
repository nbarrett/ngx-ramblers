import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject, Subscription } from "rxjs";
import { filter, take } from "rxjs/operators";
import {
  EventImageAttachApiResponse,
  EventImageAttachRequest,
  EventPublishApiResponse,
  EventPublishRequest,
  EventPublishResult,
  FacebookOAuthUrl,
  FacebookOAuthUrlApiResponse,
  FacebookPageOption,
  PublishableEvent,
  PublishableEventsApiResponse,
  FacebookPagesApiResponse,
  FacebookTokenHealth,
  FacebookTokenHealthApiResponse,
  SocialConnectionStatus,
  SocialNetwork,
  SocialConnectionStatusApiResponse,
  SocialPublication,
  SocialPublicationsApiResponse,
  SocialPublishJobRequest,
  SocialPublishProgress,
  SocialPublishResult
} from "../../models/social-publish.model";
import { EventType, MessageType } from "../../models/websocket.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { SystemConfigService } from "../system/system-config.service";
import { UrlService } from "../url.service";
import { NumberUtilsService } from "../number-utils.service";

@Injectable({
  providedIn: "root"
})
export class SocialPublishService {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialPublishService", NgxLoggerLevel.ERROR);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private webSocketClientService = inject(WebSocketClientService);
  private systemConfigService = inject(SystemConfigService);
  private urlService = inject(UrlService);
  private numberUtils = inject(NumberUtilsService);
  private BASE_URL = "/api/social";
  private progressNotifications = new Subject<SocialPublishProgress>();

  progressEvents(): Observable<SocialPublishProgress> {
    return this.progressNotifications.asObservable();
  }

  async publishAlbum(request: Omit<SocialPublishJobRequest, "jobId" | "publicBaseUrl"> & {publicBaseUrl?: string}, onProgress?: (progress: SocialPublishProgress) => void): Promise<SocialPublishResult[]> {
    await this.webSocketClientService.connect();
    const jobId = `social-publish-${this.numberUtils.generateUid()}`;
    const publicBaseUrl = request.publicBaseUrl || this.systemConfigService.systemConfig()?.group?.href || this.urlService.publicBaseUrl();
    const albumUrl = request.albumUrl || this.currentPageUrlFrom(publicBaseUrl);
    const payload: SocialPublishJobRequest = {...request, jobId, publicBaseUrl, albumUrl};
    const progressSub: Subscription = this.webSocketClientService.receiveMessages<SocialPublishProgress>(MessageType.PROGRESS)
      .pipe(filter(progress => progress?.jobId === jobId))
      .subscribe(progress => {
        this.progressNotifications.next(progress);
        if (onProgress) {
          onProgress(progress);
        }
      });
    const complete$ = firstValueFrom(
      this.webSocketClientService.receiveMessages<any>(MessageType.COMPLETE).pipe(
        filter(data => data?.jobId === jobId),
        take(1)
      )
    );
    const error$ = firstValueFrom(
      this.webSocketClientService.receiveMessages<any>(MessageType.ERROR).pipe(
        filter(data => data?.jobId === jobId),
        take(1)
      )
    );
    this.logger.info("publishAlbum: sending job", jobId, payload.networks, payload.imageNames?.length);
    this.webSocketClientService.sendMessage(EventType.SOCIAL_PUBLISH_ALBUM, payload);
    try {
      const outcome = await Promise.race([
        complete$.then(data => ({kind: "complete" as const, data})),
        error$.then(data => ({kind: "error" as const, data}))
      ]);
      progressSub.unsubscribe();
      let results: SocialPublishResult[] = [];
      if (outcome.kind === "complete") {
        results = (outcome.data?.results as SocialPublishResult[]) || [];
      } else if (outcome.data?.results) {
        results = outcome.data.results as SocialPublishResult[];
      } else {
        throw new Error(outcome.data?.message || "Social publish failed");
      }
      return results;
    } catch (error) {
      progressSub.unsubscribe();
      throw error;
    }
  }

  private currentPageUrlFrom(publicBaseUrl: string): string {
    try {
      const path = new URL(this.urlService.absoluteUrl()).pathname;
      return publicBaseUrl && path && path !== "/" ? `${publicBaseUrl.replace(/\/+$/, "")}${path}` : null;
    } catch (error) {
      this.logger.warn("could not derive the album page url:", error);
      return null;
    }
  }

  async facebookStatus(): Promise<SocialConnectionStatus> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialConnectionStatusApiResponse>(`${this.BASE_URL}/facebook/status`));
    return response.response as SocialConnectionStatus;
  }

  async instagramStatus(): Promise<SocialConnectionStatus> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialConnectionStatusApiResponse>(`${this.BASE_URL}/instagram/status`));
    return response.response as SocialConnectionStatus;
  }

  async discoverPages(accessToken: string): Promise<FacebookPageOption[]> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<FacebookPagesApiResponse>(`${this.BASE_URL}/facebook/discover-pages`, {accessToken}));
    return (response.response as FacebookPageOption[]) || [];
  }

  async facebookOAuthUrl(redirectUri: string, state: string): Promise<string> {
    const params = new HttpParams().set("redirectUri", redirectUri).set("state", state);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<FacebookOAuthUrlApiResponse>(`${this.BASE_URL}/facebook/oauth/url`, {params}));
    return (response.response as FacebookOAuthUrl)?.url;
  }

  async facebookOAuthExchange(code: string, redirectUri: string): Promise<FacebookPageOption[]> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<FacebookPagesApiResponse>(`${this.BASE_URL}/facebook/oauth/exchange`, {code, redirectUri}));
    return (response.response as FacebookPageOption[]) || [];
  }

  async facebookTokenHealth(): Promise<FacebookTokenHealth> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<FacebookTokenHealthApiResponse>(`${this.BASE_URL}/facebook/token-health`));
    return response.response as FacebookTokenHealth;
  }

  async publicationsForAlbum(albumName: string): Promise<SocialPublication[]> {
    const params = new HttpParams().set("albumName", albumName);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialPublicationsApiResponse>(`${this.BASE_URL}/publications`, {params}));
    return (response.response as SocialPublication[]) || [];
  }

  async publishEvents(eventIds: string[], networks: SocialNetwork[], republishChanged: boolean): Promise<EventPublishResult[]> {
    const request: EventPublishRequest = {eventIds, networks, republishChanged};
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<EventPublishApiResponse>(`${this.BASE_URL}/facebook/publish-events`, request));
    return (response.response as EventPublishResult[]) || [];
  }

  async attachEventImage(eventId: string, awsFileName: string): Promise<PublishableEvent> {
    const request: EventImageAttachRequest = {eventId, awsFileName};
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<EventImageAttachApiResponse>(`${this.BASE_URL}/facebook/event-image`, request));
    return response.response as PublishableEvent;
  }

  async publishableEvent(eventId: string): Promise<PublishableEvent> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<PublishableEventsApiResponse>(`${this.BASE_URL}/facebook/publishable-event/${eventId}`));
    return response.response as unknown as PublishableEvent;
  }

  async publishableEvents(fromDate: number, toDate: number): Promise<PublishableEvent[]> {
    const params = new HttpParams().set("fromDate", fromDate).set("toDate", toDate);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<PublishableEventsApiResponse>(`${this.BASE_URL}/facebook/publishable-events`, {params}));
    return (response.response as PublishableEvent[]) || [];
  }
}
