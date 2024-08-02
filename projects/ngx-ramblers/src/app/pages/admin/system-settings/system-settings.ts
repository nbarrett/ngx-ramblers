import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  colourSelectors,
  colourSelectorsDarkLight,
  NavBarLocation,
  RootFolder,
  SystemConfig,
  WalkPopulation
} from "../../../models/system.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { Member } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";

@Component({
  selector: "app-system-settings",
  templateUrl: "./system-settings.html",
})
export class SystemSettingsComponent implements OnInit, OnDestroy {

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public config: SystemConfig;
  public icons: RootFolder = RootFolder.icons;
  public logos: RootFolder = RootFolder.logos;
  public backgrounds: RootFolder = RootFolder.backgrounds;
  private subscriptions: Subscription[] = [];
  public populationMethods: KeyValue<string>[] = enumKeyValues(WalkPopulation);
  public membersPendingSave: Member[] = [];
  private memberService: MemberService = inject(MemberService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private notifierService: NotifierService = inject(NotifierService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private broadcastService: BroadcastService<string> = inject(BroadcastService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("SystemSettingsComponent", NgxLoggerLevel.DEBUG);
  navbarLocations: KeyValue<string>[] = enumKeyValues(NavBarLocation);
  protected readonly colourSelectorsDarkLight = colourSelectorsDarkLight;
  protected readonly colourSelectors = colourSelectors;

  ngOnInit() {
    this.logger.debug("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.debug("event received:", namedEvent);
      this.headerLogoChanged(namedEvent.data);
    });
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.debug("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


  savePendingMembers() {
    if (this.membersPendingSave.length > 0) {
      this.logger.info("saving", this.stringUtils.pluraliseWithCount(this.membersPendingSave.length, "member"), "pending save");
      return this.memberService.createOrUpdateAll(this.membersPendingSave).catch((error) => this.notify.error({
        title: "Error saving changed members",
        message: error
      }));
    }
  }

  async save() {
    this.logger.debug("saving config", this.config);
    await this.savePendingMembers();
    this.systemConfigService.saveConfig(this.config)
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.notify.error({title: "Error saving system config", message: error}));
  }

  cancel() {
    this.systemConfigService.refresh();
    this.urlService.navigateTo(["admin"]);
  }

  headerLogoChanged(logo: string) {
    if (this.config?.header?.selectedLogo) {
      this.config.header.selectedLogo = logo;
    }
  }
}
