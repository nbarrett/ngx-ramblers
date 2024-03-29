import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { ConfigKey } from "../../models/config.model";
import { Images, Organisation, Ramblers, RootFolder, SystemConfig, WalkPopulation } from "../../models/system.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class SystemConfigService {

  private subject = new ReplaySubject<SystemConfig>();
  private logger: Logger;
  private cachedSystemConfig: SystemConfig;

  constructor(private config: ConfigService,
              private broadcastService: BroadcastService<SystemConfig>,
              public stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SystemConfigService", NgxLoggerLevel.OFF);
    this.refresh();
  }

  async refresh() {
      this.logger.info("cachedSystemConfig query:started");
      this.cachedSystemConfig = await this.getConfig();
      this.logger.info("notifying cachedSystemConfig subscribers with:", this.cachedSystemConfig);
      this.subject.next(this.cachedSystemConfig);
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SYSTEM_CONFIG_LOADED, this.cachedSystemConfig));
  }

  private async getConfig(): Promise<SystemConfig> {
    return await this.config.queryConfig<SystemConfig>(ConfigKey.SYSTEM, this.default());
  }

  imageTypeDescription(imageType: RootFolder) {
    return this.stringUtils.asTitle(imageType);
  }

  saveConfig(config: SystemConfig) {
    return this.config.saveConfig<SystemConfig>(ConfigKey.SYSTEM, config).then(() => this.refresh());
  }

  public systemConfig(): SystemConfig {
    return this.cachedSystemConfig;
  }
  public events(): Observable<SystemConfig> {
    return this.subject.pipe(shareReplay());
  }

  private emptyOrganisation(): Organisation {
    return {
      href: null,
      longName: null,
      pages: [],
      shortName: null,
      walkPopulation: WalkPopulation.WALKS_MANAGER
    };
  }

  public defaultImages(imageType: RootFolder): Images {
    return {rootFolder: imageType, images: []};
  }

  default(): SystemConfig {
    return {
      backgrounds: this.defaultImages(RootFolder.backgrounds),
      icons: this.defaultImages(RootFolder.icons),
      logos: this.defaultImages(RootFolder.logos),
      externalSystems: {
        facebook: {appId: null, pagesUrl: null, groupUrl: null},
        meetup: null,
        instagram: null,
        linkedIn: null
      },
      area: this.emptyOrganisation(), group: this.emptyOrganisation(), national: this.defaultRamblersConfig(),
      header: {selectedLogo: null, navigationButtons: []},
      footer: {appDownloads: {apple: undefined, google: undefined}, legals: [], pages: [], quickLinks: []}
    };
  };

  public defaultRamblersConfig(): Ramblers {
    return {
      mainSite: {
        href: "https://ramblers.org.uk",
        title: "Ramblers"
      },
      walksManager: {
        href: "https://walks-manager.ramblers.org.uk/walks-manager",
        title: "Walks Manager",
        apiKey: null,
        password: null,
        userName: null
      }
    };
  }
}
