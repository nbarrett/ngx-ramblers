import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { ConfigKey } from "../../models/config.model";
import {
  defaultHeaderBar,
  defaultNavbar,
  defaultRamblersConfig,
  defaultRightPanel,
  ExternalSystems,
  Images,
  MailProvider,
  Organisation,
  RootFolder,
  SystemConfig,
  WalkPopulation
} from "../../models/system.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";
import cloneDeep from "lodash-es/cloneDeep";
import isEqual from "lodash-es/isEqual";

@Injectable({
  providedIn: "root"
})
export class SystemConfigService {

  private subject = new ReplaySubject<SystemConfig>();
  private logger: Logger;
  private cachedSystemConfig: SystemConfig;
  private dryRun = false;
  private migrate = true;

  constructor(private config: ConfigService,
              private broadcastService: BroadcastService<SystemConfig>,
              public stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SystemConfigService", NgxLoggerLevel.ERROR);
    this.refresh();
  }

  async refresh() {
    this.logger.info("refresh query:started");
    const cachedSystemConfig = await this.getConfig();
    this.cacheAndNotify(cachedSystemConfig);
  }

  private cacheAndNotify(systemConfig: SystemConfig) {
    this.cachedSystemConfig = systemConfig;
    this.logger.info("notifying systemConfig subscribers with:", this.cachedSystemConfig);
    this.subject.next(this.cachedSystemConfig);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SYSTEM_CONFIG_LOADED, this.cachedSystemConfig));
  }

  private async getConfig(): Promise<SystemConfig> {
    const config = await this.config.queryConfig<SystemConfig>(ConfigKey.SYSTEM, this.default());
    if (this.migrate) {
      return this.migrateConfigIfRequired(config);
    } else {
      return config;
    }
  }

  private async migrateConfigIfRequired(config: SystemConfig): Promise<SystemConfig> {
    const preMigrationConfig = cloneDeep(config);
    const externalSystemsMigrate = this.migrateConfigKeyIfRequired(config, "externalUrls", "externalSystems");
    const facebookMigrate = this.prepareMigration(config.externalSystems, "facebook");
    const instagramMigrate = this.prepareMigration(config.externalSystems, "instagram");
    const meetupMigrate = this.prepareMigration(config.externalSystems, "meetup");
    if (!config?.mailDefaults?.mailProvider) {
      config.mailDefaults = this.mailDefaults();
    }
    if (!config.externalSystems.facebook) {
      config.externalSystems.facebook = {appId: null, pagesUrl: null, groupUrl: null, showFeed: true};
      this.logger.info("migrated facebook to", config.externalSystems.facebook);
    } else {
      this.logger.info("nothing to migrate for facebook", config.externalSystems.facebook);
    }
    if (!config.externalSystems.instagram) {
      this.logger.info("migrated instagram to", config.externalSystems.instagram);
      config.externalSystems.instagram = {
        userId: null,
        accessToken: null,
        clientId: null,
        clientSecret: null,
        groupName: null,
        showFooterLink: false,
        groupUrl: null,
        showFeed: true
      };
    } else {
      this.logger.info("nothing to migrate for instagram", config.externalSystems.instagram);
    }
    if (!config.externalSystems.meetup) {
      this.logger.info("migrated meetup to", config.externalSystems.meetup);
      config.externalSystems.meetup = {groupUrl: null, apiUrl: null, groupName: null, accessToken: null, apiKey: null};
    } else {
      this.logger.info("nothing to migrate for meetup", config.externalSystems.meetup);
    }
    if (!config?.national?.mainSite) {
      config.national = defaultRamblersConfig;
      this.logger.info("config.national.mainSite initialised as:", config.national);
    }
    if (!config?.header?.navBar) {
      config.header.navBar = defaultNavbar;
      this.logger.info("config.header.navBar initialised as:", config.header.navBar);
    }
    if (!config?.header?.headerBar) {
      config.header.headerBar = defaultHeaderBar;
      this.logger.info("config.header.headerBar initialised as:", config.header.headerBar);
    }
    if (!config?.header?.rightPanel?.socialMediaLinks?.colour) {
      config.header.rightPanel = defaultRightPanel;
      this.logger.info("config.header.rightPanel initialised as:", config.header.rightPanel);
    }
    if (externalSystemsMigrate || facebookMigrate || instagramMigrate || meetupMigrate || !isEqual(preMigrationConfig, config)) {
      if (this.dryRun) {
        this.logger.info("Would normally save here but dry run for config:", config);
        return Promise.resolve(config);
      } else {
        this.logger.info("Saving migrated config:", config);
        await this.saveConfig(config);
        return this.cachedSystemConfig;
      }
    } else {
      this.logger.info("nothing to migrate for config:", config);
      return Promise.resolve(config);
    }
  }

  private prepareMigration(externalSystems: ExternalSystems, field: string): boolean {
    const needsMigration = this.needsMigration(externalSystems, field);
    if (needsMigration) {
      this.logger.debug("externalSystems ", field, "with value", externalSystems[field], "needs migration");
      externalSystems[field] = null;
    } else {
      this.logger.debug("externalSystems ", field, "with value", externalSystems[field], "already migrated");
    }
    return needsMigration;
  }

  private migrateConfigKeyIfRequired(systemConfig: SystemConfig, oldKey: string, newKey: string): boolean {
    const needsMigration = !systemConfig[newKey] && systemConfig[oldKey];
    if (needsMigration) {
      this.logger.debug("migrating systemConfig old key", oldKey, "to new key", newKey);
      systemConfig[newKey] = systemConfig[oldKey];
      delete systemConfig[oldKey];
    } else {
      this.logger.debug("systemConfig ", newKey, "with value", systemConfig[newKey], "already migrated");
    }
    return needsMigration;
  }

  private needsMigration(externalSystems: ExternalSystems, field: string): boolean {
    return typeof externalSystems[field] === "string";
  }

  imageTypeDescription(imageType: RootFolder) {
    return this.stringUtils.asTitle(imageType);
  }

  saveConfig(config: SystemConfig) {
    return this.config.saveConfig<SystemConfig>(ConfigKey.SYSTEM, config).then((savedConfig: any) => this.cacheAndNotify(savedConfig.value));
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
      mailDefaults: this.mailDefaults(),
      backgrounds: this.defaultImages(RootFolder.backgrounds),
      icons: this.defaultImages(RootFolder.icons),
      logos: this.defaultImages(RootFolder.logos),
      externalSystems: {
        facebook: {appId: null, pagesUrl: null, groupUrl: null},
        meetup: null,
        instagram: null,
        linkedIn: null
      },
      area: this.emptyOrganisation(), group: this.emptyOrganisation(), national: defaultRamblersConfig,
      header: {selectedLogo: null, navigationButtons: []},
      footer: {appDownloads: {apple: undefined, google: undefined}, legals: [], pages: [], quickLinks: []}
    };
  };

  public mailDefaults() {
    return {
      mailProvider: MailProvider.NONE,
      autoSubscribeNewMembers: false
    };
  }


}
