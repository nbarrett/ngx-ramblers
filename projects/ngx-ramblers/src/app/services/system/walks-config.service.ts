import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { ConfigKey } from "../../models/config.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import {
  DEFAULT_REGULAR_WALK_DAY,
  DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS,
  WalkAlbumPanelStyle,
  WalkDetailsImageStyle,
  WalkDetailsMapProvider,
  WalkRiskAssessmentSection,
  WalksConfig,
  DEFAULT_GRID_REFERENCE_DIGITS
} from "../../models/walks-config.model";
import { AccessLevel } from "../../models/member-resource.model";

@Injectable({
  providedIn: "root"
})
export class WalksConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private broadcastService = inject<BroadcastService<WalksConfig>>(BroadcastService);
  private subject = new ReplaySubject<WalksConfig>();
  private cachedWalksConfig: WalksConfig;
  private initialLoad: Promise<WalksConfig>;

  constructor() {
    this.initialLoad = this.refresh();
    this.initialLoad.catch(error => this.logger.error("initial walks config load failed:", error));
  }

  async refresh(): Promise<WalksConfig> {
    this.logger.info("refresh query:started");
    const cachedWalksConfig = await this.getConfig();
    this.cacheAndNotify(cachedWalksConfig);
    return this.cachedWalksConfig;
  }

  private cacheAndNotify(walksConfig: WalksConfig) {
    this.cachedWalksConfig = this.normalise(walksConfig);
    this.logger.info("notifying walksConfig subscribers with:", this.cachedWalksConfig);
    this.subject.next(this.cachedWalksConfig);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALKS_CONFIG_LOADED, this.cachedWalksConfig));
  }

  private async getConfig(): Promise<WalksConfig> {
    return await this.config.queryConfig<WalksConfig>(ConfigKey.WALKS, this.default());
  }

  saveConfig(config: WalksConfig) {
    return this.config.saveConfig<WalksConfig>(ConfigKey.WALKS, this.normalise(config)).then((savedConfig: any) => this.cacheAndNotify(savedConfig.value));
  }

  public walksConfig(): WalksConfig {
    return this.cachedWalksConfig;
  }

  public walksConfigLoaded(): Promise<WalksConfig> {
    if (this.cachedWalksConfig) {
      return Promise.resolve(this.cachedWalksConfig);
    } else {
      return this.initialLoad.catch(() => this.refresh());
    }
  }

  public events(): Observable<WalksConfig> {
    return this.subject.pipe(shareReplay());
  }

  private normalise(config: WalksConfig): WalksConfig {
    const defaults = this.default();
    return {
      ...defaults,
      ...config,
      riskAssessmentSections: config?.riskAssessmentSections?.length
        ? config.riskAssessmentSections
        : defaults.riskAssessmentSections
    };
  }

  public riskAssessmentSections(): WalkRiskAssessmentSection[] {
    return this.normalise(this.cachedWalksConfig || this.default()).riskAssessmentSections;
  }

  default(): WalksConfig {
    return {
      milesPerHour: 2.13,
      mapZoomOutLevels: 2,
      requireRiskAssessment: true,
      riskAssessmentSections: DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS,
      requireFinishTime: true,
      requireWalkLeaderDisplayName: true,
      matchWalkLeadersOnWalksManagerSync: true,
      rematchWalkLeadersOnMemberChange: true,
      relatedLinkShowOnRamblers: true,
      relatedLinkShowMeetup: true,
      relatedLinkShowOsMaps: true,
      relatedLinkShowWhat3words: true,
      relatedLinkShowDirections: true,
      relatedLinkShowVenue: true,
      relatedLinkShowGpx: true,
      relatedLinkShowCalendar: true,
      regularWalkDay: DEFAULT_REGULAR_WALK_DAY,
      walkCreationAccessLevel: AccessLevel.HIDDEN,
      hideAwaitingLeaderFromPublic: false,
      hideNonApprovedWalksFromPublic: false,
      walkDetailsShowPostcode: true,
      walkDetailsShowGridReference: true,
      walkDetailsGridReferenceDigits: DEFAULT_GRID_REFERENCE_DIGITS,
      walkDetailsGridReferenceSpaced: true,
      walkDetailsImageStyle: WalkDetailsImageStyle.CROPPED,
      walkDetailsImageHeight: 200,
      walkDetailsMapHeight: 380,
      walkDetailsMapProvider: WalkDetailsMapProvider.OS_MAPS,
      walkAlbumPanelStyle: WalkAlbumPanelStyle.CARD,
      walkAlbumPanelHeight: 240
    };
  };

}
