import { Component, OnDestroy, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BannerImageType, ExternalSystems, SystemConfig, WalkPopulation } from "../../../models/system.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { enumKeyValues, KeyValue } from "../../../services/enums";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-system-settings",
  templateUrl: "./system-settings.html",
})
export class SystemSettingsComponent implements OnInit, OnDestroy {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public config: SystemConfig;
  public icons: BannerImageType = BannerImageType.icons;
  public logos: BannerImageType = BannerImageType.logos;
  public backgrounds: BannerImageType = BannerImageType.backgrounds;
  faAdd = faAdd;
  private subscriptions: Subscription[] = [];
  public populationMethods: KeyValue[] = enumKeyValues(WalkPopulation);

  constructor(public systemConfigService: SystemConfigService,
              private notifierService: NotifierService,
              public stringUtils: StringUtilsService,
              private memberService: MemberService,
              private memberLoginService: MemberLoginService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              private broadcastService: BroadcastService<string>,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SystemSettingsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.info("event received:", namedEvent);
      this.headerLogoChanged(namedEvent.data);
    });
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.prepareMigrationIfRequired(config);
        this.migrateDataIfRequired(config);
        if (!this.config?.national?.mainSite) {
          this.config.national = this.systemConfigService.defaultRamblersConfig();
        }
        this.logger.info("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private prepareMigrationIfRequired(config: SystemConfig) {
    const externalSystemsMigrate = this.migrateConfigKeyIfRequired(config, "externalUrls", "externalSystems");
    const facebookMigrate = this.prepareMigration(config.externalSystems, "facebook");
    const instagramMigrate = this.prepareMigration(config.externalSystems, "instagram");
    const meetupMigrate = this.prepareMigration(config.externalSystems, "meetup");
    if (externalSystemsMigrate || facebookMigrate || instagramMigrate || meetupMigrate) {
      this.systemConfigService.saveConfig(config);
    }
  }

  private migrateDataIfRequired(config: SystemConfig) {
    if (!config.externalSystems.facebook) {
      this.config.externalSystems.facebook = {appId: null, pagesUrl: null, groupUrl: null, showFeed: true};
      this.logger.info("migrated facebook to", this.config.externalSystems.facebook);
    } else {
      this.logger.info("nothing to migrate for facebook", this.config.externalSystems.facebook);
    }
    if (!config.externalSystems.instagram) {
      this.logger.info("migrated instagram to", this.config.externalSystems.instagram);
      this.config.externalSystems.instagram = {groupUrl: null, showFeed: true};
    } else {
      this.logger.info("nothing to migrate for instagram", this.config.externalSystems.instagram);
    }
    if (!config.externalSystems.meetup) {
      this.logger.info("migrated meetup to", this.config.externalSystems.meetup);
      this.config.externalSystems.meetup = {groupUrl: null, apiUrl: null, groupName: null, accessToken: null, apiKey: null};
    } else {
      this.logger.info("nothing to migrate for meetup", this.config.externalSystems.meetup);
    }
  }

  private prepareMigration(externalSystems: ExternalSystems, field: string): boolean {
    const needsMigration = this.needsMigration(externalSystems, field);
    if (needsMigration) {
      this.logger.info("externalSystems ", field, "with value", externalSystems[field], "needs migration");
      externalSystems[field] = null;
    } else {
      this.logger.info("externalSystems ", field, "with value", externalSystems[field], "already migrated");
    }
    return needsMigration;
  }

  private migrateConfigKeyIfRequired(systemConfig: SystemConfig, oldKey: string, newKey: string): boolean {
    const needsMigration = !systemConfig[newKey] && systemConfig[oldKey];
    if (needsMigration) {
      this.logger.info("migrating systemConfig old key", oldKey, "to new key", newKey);
      systemConfig[newKey] = systemConfig[oldKey];
      delete systemConfig[oldKey];
    } else {
      this.logger.info("systemConfig ", newKey, "with value", systemConfig[newKey], "already migrated");
    }
    return needsMigration;
  }

  private needsMigration(externalSystems: ExternalSystems, field: string): boolean {
    return typeof externalSystems[field] === "string";
  }

  save() {
    this.logger.debug("saving config", this.config);
    this.systemConfigService.saveConfig(this.config)
      .then(() => this.urlService.navigateTo("admin"))
      .catch((error) => this.notify.error({title: "Error saving system config", message: error}));
  }

  cancel() {
    this.urlService.navigateTo("admin");
  }

  headerLogoChanged(logo: string) {
    this.config.header.selectedLogo = logo;
  }

}
