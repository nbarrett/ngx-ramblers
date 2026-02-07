import { inject, Injectable } from "@angular/core";
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
  EventPopulation,
  ExternalSystems,
  GoogleAnalyticsConfig,
  GoogleMapsConfig,
  ImageConfig,
  Images,
  MailProvider,
  Organisation,
  RootFolder,
  SystemConfig
} from "../../models/system.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";
import { cloneDeep, isEqual, isNil, isString } from "es-toolkit/compat";
import { WalkListView } from "../../models/walk.model";
import { RAMBLERS_LANDING_PAGE } from "../../models/images.model";
import { HasStyles, LinkStyle, ListStyle } from "../../models/content-text.model";

@Injectable({
  providedIn: "root"
})
export class SystemConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private broadcastService = inject<BroadcastService<SystemConfig>>(BroadcastService);
  stringUtils = inject(StringUtilsService);
  private subject = new ReplaySubject<SystemConfig>();
  private cachedSystemConfig: SystemConfig;
  private dryRun = false;
  private migrate = true;

  constructor() {
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
      config.externalSystems.facebook = {appId: null, pagesUrl: null, groupUrl: null, showFeed: true, showFooterLink: false};
      this.logger.info("migrated facebook to", config.externalSystems.facebook);
    } else if (isNil(config.externalSystems.facebook.showFooterLink)) {
      config.externalSystems.facebook.showFooterLink = !!config.externalSystems.facebook.groupUrl;
      this.logger.info("migrated facebook showFooterLink to", config.externalSystems.facebook.showFooterLink);
    } else {
      this.logger.info("nothing to migrate for facebook", config.externalSystems.facebook);
    }
    if (!config.externalSystems.instagram) {
      this.logger.info("migrated instagram to", config.externalSystems.instagram);
      config.externalSystems.instagram = {
        accessToken: null,
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
      config.externalSystems.meetup = {
        accessToken: null,
        apiUrl: null,
        clientId: null,
        clientRedirectUrl: null,
        clientSecret: null,
        groupName: null,
        groupUrl: null,
        refreshToken: null,
        showFooterLink: false
      };
    } else if (isNil(config.externalSystems.meetup.showFooterLink)) {
      config.externalSystems.meetup.showFooterLink = !!config.externalSystems.meetup.groupUrl;
      this.logger.info("migrated meetup showFooterLink to", config.externalSystems.meetup.showFooterLink);
    } else {
      this.logger.info("nothing to migrate for meetup", config.externalSystems.meetup);
    }
    if (!config.externalSystems.osMaps) {
      config.externalSystems.osMaps = {apiKey: null};
      this.logger.info("config.externalSystems.osMaps initialised as:", config.externalSystems.osMaps);
    }
    if (!config?.national?.mainSite) {
      config.national = defaultRamblersConfig;
      this.logger.info("config.national.mainSite initialised as:", config.national);
    }
    if (!config?.header?.navBar) {
      config.header.navBar = defaultNavbar;
      this.logger.info("config.header.navBar initialised as:", config.header.navBar);
    }
    if (!config?.header?.navBar?.justification) {
      config.header.navBar.justification = defaultNavbar.justification;
      this.logger.info("config.header.navBar.justification initialised as:", config.header.navBar.justification);
    }
    if (!config?.header?.headerBar) {
      config.header.headerBar = defaultHeaderBar;
      this.logger.info("config.header.headerBar initialised as:", config.header.headerBar);
    }
    if (!config?.header?.rightPanel?.socialMediaLinks?.colour) {
      config.header.rightPanel = defaultRightPanel;
      this.logger.info("config.header.rightPanel initialised as:", config.header.rightPanel);
    }
    if (!config?.images?.imageLists) {
      config.images = this.imagesDefaults();
      this.logger.info("config.images initialised as:", config.images);
    }
    if (externalSystemsMigrate || facebookMigrate || instagramMigrate || meetupMigrate || !isEqual(preMigrationConfig, config)) {
      this.logger.info("Applying in-memory migration only (no save during app bootstrap)", config);
      return Promise.resolve(config);
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
    return isString(externalSystems[field]);
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
      defaultWalkListView: WalkListView.CARDS,
      allowSwitchWalkView: false,
      walkContactDetailsPublic: true,
      socialDetailsPublic: true,
      mapOutlierMaxDistanceMiles: 800,
      href: null,
      longName: null,
      pages: [],
      shortName: null,
      socialEventPopulation: EventPopulation.WALKS_MANAGER,
      walkPopulation: EventPopulation.WALKS_MANAGER
    };
  }

  public defaultImages(imageType: RootFolder): Images {
    return {rootFolder: imageType, images: []};
  }

  public imagesDefaults(): ImageConfig {
    return {
      imageLists: {
        defaultMaxImageSize: 0,
        defaultAspectRatio: RAMBLERS_LANDING_PAGE
      },
    };
  }

  defaultHasStyles(): HasStyles {
    return {list: ListStyle.ARROW, link: LinkStyle.NORMAL};
  }

  default(): SystemConfig {
    return {
      globalStyles: this.defaultHasStyles(),
      enableMigration: {events: false},
      googleAnalytics: this.googleAnalyticsDefaults(),
      googleMaps: this.googleMapsDefaults(),
      recaptcha: this.recaptchaDefaults(),
      mailDefaults: this.mailDefaults(),
      backgrounds: this.defaultImages(RootFolder.backgrounds),
      icons: this.defaultImages(RootFolder.icons),
      logos: this.defaultImages(RootFolder.logos),
      images: this.imagesDefaults(),
      externalSystems: {
        facebook: {appId: null, pagesUrl: null, groupUrl: null},
        osMaps: {apiKey: null},
        meetup: null,
        instagram: null,
        linkedIn: null
      },
      area: this.emptyOrganisation(), group: this.emptyOrganisation(), national: defaultRamblersConfig,
      header: {selectedLogo: null, navigationButtons: []},
      footer: {appDownloads: {apple: undefined, google: undefined}, legals: [], pages: [], quickLinks: []}
    };
  };

  public recaptchaDefaults() {
    return {siteKey: null, secretKey: null};
  }

  public mailDefaults() {
    return {
      mailProvider: MailProvider.NONE,
      autoSubscribeNewMembers: false
    };
  }

  public googleAnalyticsDefaults(): GoogleAnalyticsConfig {
    return {trackingId: null};
  }

  public googleMapsDefaults(): GoogleMapsConfig {
    return {apiKey: null};
  }
}
