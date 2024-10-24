import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  colourSelectors,
  colourSelectorsDarkLight,
  EventPopulation,
  NavBarLocation,
  RootFolder,
  SystemConfig,
  SystemSettingsTab
} from "../../../models/system.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { enumKeyValues, enumValueForKey, KeyValue } from "../../../functions/enums";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { Member } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";
import kebabCase from "lodash-es/kebabCase";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../models/ui-actions";

@Component({
  selector: "app-system-settings",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset" *ngIf="config">
            <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.GROUP_DETAILS)}}"
                 [active]="tabActive(SystemSettingsTab.GROUP_DETAILS)"
                 (selectTab)="selectTab(SystemSettingsTab.GROUP_DETAILS)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="group-href">Web Url</label>
                      <input [(ngModel)]="config.group.href"
                             type="text" class="form-control input-sm"
                             id="group-href"
                             placeholder="Enter a link">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="group-long-name">Long Name</label>
                      <input [(ngModel)]="config.group.longName"
                             type="text" class="form-control input-sm"
                             id="group-long-name"
                             placeholder="Enter a title for group long name">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="group-short-name">Short Name</label>
                      <input [(ngModel)]="config.group.shortName"
                             type="text" class="form-control input-sm"
                             id="group-short-name"
                             placeholder="Enter a title for group short name">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="group-group-code">Ramblers Group Code</label>
                      <input [(ngModel)]="config.group.groupCode"
                             type="text" class="form-control input-sm"
                             id="group-group-code"
                             placeholder="Enter the Ramblers group code">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="walk-population">Walk Population</label>
                      <select [(ngModel)]="config.group.walkPopulation"
                              class="form-control" id="walk-population">
                        <option *ngFor="let walkPopulation of populationMethods"
                                [ngValue]="walkPopulation.value">{{ stringUtils.asTitle(walkPopulation.value) }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label for="social-event-population">Social Event Population</label>
                      <select [(ngModel)]="config.group.socialEventPopulation"
                              class="form-control" id="social-event-population">
                        <option *ngFor="let walkPopulation of populationMethods"
                                [ngValue]="walkPopulation.value">{{ stringUtils.asTitle(walkPopulation.value) }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
                <app-links-edit [heading]='"Pages on Site"' [links]="config.group.pages"></app-links-edit>
              </div>
            </tab>
            <tab app-image-collection-settings
                 heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.BACKGROUNDS)}}"
                 [active]="tabActive(SystemSettingsTab.BACKGROUNDS)"
                 (selectTab)="selectTab(SystemSettingsTab.BACKGROUNDS)"
                 [rootFolder]="backgrounds"
                 [config]="config"
                 [images]="config.backgrounds">
            </tab>
            <tab app-image-collection-settings heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.ICONS)}}"
                 [active]="tabActive(SystemSettingsTab.ICONS)"
                 (selectTab)="selectTab(SystemSettingsTab.ICONS)"
                 [rootFolder]="icons"
                 [config]="config"
                 [images]="config.icons">
            </tab>
            <tab app-image-collection-settings heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.LOGOS)}}"
                 [active]="tabActive(SystemSettingsTab.LOGOS)"
                 (selectTab)="selectTab(SystemSettingsTab.LOGOS)"
                 [rootFolder]="logos"
                 [config]="config"
                 [images]="config.logos">
            </tab>
            <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.WEBSITE_HEADER)}}"
                 [active]="tabActive(SystemSettingsTab.WEBSITE_HEADER)"
                 (selectTab)="selectTab(SystemSettingsTab.WEBSITE_HEADER)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-links-edit [heading]="'Header Buttons'" [links]="config.header.navigationButtons"/>
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Header Bar</div>
                  <div class="row">
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.headerBar.show"
                               type="checkbox" class="custom-control-input" id="show-header-bar">
                        <label class="custom-control-label"
                               for="show-header-bar">Show
                        </label>
                      </div>
                    </div>
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.headerBar.showLoginLinksAndSiteEdit"
                               [disabled]="!config.header.headerBar.show"
                               type="checkbox" class="custom-control-input"
                               id="show-header-bar-login-links-and-site-edit">
                        <label class="custom-control-label"
                               for="show-header-bar-login-links-and-site-edit">Show Login Links and Site Edit
                        </label>
                      </div>
                    </div>
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.headerBar.showNavigationButtons"
                               [disabled]="!config.header.headerBar.show"
                               type="checkbox" class="custom-control-input" id="show-header-bar-buttons">
                        <label class="custom-control-label"
                               for="show-header-bar-buttons">Show Header Buttons
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Header Right Panel</div>
                  <div class="row">
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.rightPanel.show"
                               type="checkbox" class="custom-control-input" id="show-right-panel">
                        <label class="custom-control-label"
                               for="show-right-panel">Show
                        </label>
                      </div>
                    </div>
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.rightPanel.showNavigationButtons"
                               [disabled]="!config.header.rightPanel.show"
                               type="checkbox" class="custom-control-input" id="show-header-buttons">
                        <label class="custom-control-label"
                               for="show-header-buttons">Show Header Buttons
                        </label>
                      </div>
                    </div>
                    <div class="col-md-12">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="config.header.rightPanel.showLoginLinksAndSiteEdit"
                               [disabled]="!config.header.rightPanel.show"
                               type="checkbox" class="custom-control-input" id="show-login-links-and-site-edit">
                        <label class="custom-control-label"
                               for="show-login-links-and-site-edit">Show Login Links and Site Edit
                        </label>
                      </div>
                    </div>
                    <div class="col-md-12">
                      <div class="form-inline d-flex align-items-center justify-content-between">
                        <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="config.header.rightPanel.socialMediaLinks.show"
                                 [disabled]="!config.header.rightPanel.show"
                                 type="checkbox" class="custom-control-input" id="show-social-media-links">
                          <label class="custom-control-label"
                                 for="show-social-media-links">Show Social Media Links
                          </label>
                        </div>
                        <label for="social-mediaLinks-width">Width</label>
                        <input [(ngModel)]="config.header.rightPanel.socialMediaLinks.width"
                               id="social-mediaLinks-width"
                               type="number" class="form-control input-sm">
                        <label>Colour</label>
                        <app-colour-selector [itemWithClassOrColour]="config.header.rightPanel.socialMediaLinks"
                                             [colours]="colourSelectors" noLabel/>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Navbar</div>
                  <div class="row">
                    <div class="col-sm-6">
                      <label for="navbar-location">Navbar Location</label>
                      <select class="form-control input-sm"
                              [(ngModel)]="config.header.navBar.location"
                              id="navbar-location">
                        <option *ngFor="let type of navbarLocations"
                                [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                        </option>
                      </select>
                    </div>
                    <div class="col-sm-6">
                      <app-colour-selector [itemWithClassOrColour]="config.header.navBar"
                                           [colours]="colourSelectorsDarkLight"
                                           label="Navbar Colour"/>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.WEBSITE_FOOTER)}}"
                 [active]="tabActive(SystemSettingsTab.WEBSITE_FOOTER)"
                 (selectTab)="selectTab(SystemSettingsTab.WEBSITE_FOOTER)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Column 1: External Urls</div>
                  <div class="col-md-12">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="config.externalSystems.facebook.showFeed"
                             type="checkbox" class="custom-control-input" id="facebook-show-feed">
                      <label class="custom-control-label"
                             for="facebook-show-feed">Show Facebook Feed
                      </label>
                    </div>
                    <div class="form-group">
                      <label for="facebook-group-url">Facebook Group Url</label>
                      <input [(ngModel)]="config.externalSystems.facebook.groupUrl"
                             type="text" class="form-control input-sm" id="facebook-group-url"
                             placeholder="Enter a group url for Facebook">
                    </div>
                    <div class="form-group">
                      <label for="facebook-pages-url">Facebook Pages Url (optional)</label>
                      <input [(ngModel)]="config.externalSystems.facebook.pagesUrl"
                             type="text" class="form-control input-sm" id="facebook-pages-url"
                             placeholder="Enter a pages url for Facebook">
                    </div>
                    <div class="form-group">
                      <label for="facebook-appId">Facebook App Id</label>
                      <input [(ngModel)]="config.externalSystems.facebook.appId"
                             type="text" class="form-control input-sm" id="facebook-appId"
                             placeholder="Enter an app id for Facebook">
                    </div>
                    <div class="row">
                      <div class="col-md-6">
                        <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="config.externalSystems.meetup.showFooterLink"
                                 type="checkbox" class="custom-control-input" id="meetup-show-footer-link">
                          <label class="custom-control-label"
                                 for="meetup-show-footer-link">Show Meetup
                          </label>
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="form-inline">
                          <label>Meetup Link Preview:</label>
                          <a class="ml-2"
                             [href]="config.externalSystems.meetup.groupUrl+'/'+config.externalSystems.meetup.groupName">{{ config.externalSystems.meetup.groupName }}</a>
                        </div>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="youtube-href">Youtube</label>
                      <input [(ngModel)]="config.externalSystems.youtube"
                             type="text" class="form-control input-sm" id="youtube-href"
                             placeholder="Enter a group url for Youtube">
                    </div>
                    <div class="form-group">
                      <label for="twitter-href">Twitter</label>
                      <input [(ngModel)]="config.externalSystems.twitter"
                             type="text" class="form-control input-sm" id="twitter-href"
                             placeholder="Enter a group url for Twitter">
                    </div>
                    <div class="row">
                      <div class="col-md-6">
                        <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="config.externalSystems.instagram.showFooterLink"
                                 type="checkbox" class="custom-control-input" id="instagram-show-footer-link">
                          <label class="custom-control-label"
                                 for="instagram-show-footer-link">Show Instagram
                          </label>
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="form-inline">
                          <label>Instagram Link Preview:</label>
                          <a class="ml-2"
                             [href]="config.externalSystems.instagram.groupUrl+'/'+config.externalSystems.instagram.groupName">{{ config.externalSystems.instagram.groupName }}</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <app-links-edit [heading]='"Column 2: Quick Links"' [links]="config.footer.quickLinks"></app-links-edit>
                <app-links-edit [heading]='"Column 3: Legals"' [links]="config.footer.legals"></app-links-edit>
                <div class="row img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Column 4: Download Links</div>
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="area-long-name">Apple</label>
                      <input [(ngModel)]="config.footer.appDownloads.apple"
                             id="area-long-name"
                             class="form-control input-sm">
                    </div>
                    <div class="form-group">
                      <label for="area-short-name">Google</label>
                      <input [(ngModel)]="config.footer.appDownloads.google"
                             id="area-short-name"
                             class="form-control input-sm">
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.RAMBLERS_DETAILS)}}"
                 [active]="tabActive(SystemSettingsTab.RAMBLERS_DETAILS)"
                 (selectTab)="selectTab(SystemSettingsTab.RAMBLERS_DETAILS)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row" *ngIf="config?.national?.mainSite">
                  <div class="col-md-5">
                    <div class="form-group">
                      <label for="main-site-href">Main Site Web Url</label>
                      <input [(ngModel)]="config.national.mainSite.href"
                             id="main-site-href"
                             type="text" class="form-control input-sm"
                             placeholder="Enter main site link">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="form-group">
                      <label for="main-site-title">Main Site Name</label>
                      <input [(ngModel)]="config.national.mainSite.title"
                             id="main-site-title"
                             type="text" class="form-control input-sm"
                             placeholder="Enter main site title">
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="form-group">
                      <label>Link Preview</label>
                    </div>
                    <div class="form-group">
                      <a
                        [href]="config.national.mainSite.href">{{ config.national.mainSite.title || config.national.mainSite.href }}</a>
                    </div>
                  </div>
                  <div class="col-md-5">
                    <div class="form-group">
                      <label for="walks-manager-href">Walks Manager Web Url</label>
                      <input [(ngModel)]="config.national.walksManager.href" id="walks-manager-href"
                             type="text" class="form-control input-sm"
                             placeholder="Enter Walks Manager site link">
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="form-group">
                      <label for="walks-manager-title">Walks Manager Name</label>
                      <input [(ngModel)]="config.national.walksManager.title"
                             id="walks-manager-title"
                             type="text" class="form-control input-sm"
                             placeholder="Enter Walks Manager site title">
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="form-group">
                      <label>Link Preview</label>
                    </div>
                    <div class="form-group">
                      <a
                        [href]="config.national.walksManager.href">{{ config.national.walksManager.title || config.national.walksManager.href }}</a>
                    </div>
                  </div>
                  <div class="col-md-5">
                    <form class="form-group">
                      <label for="walks-manager-user-name">Walks Manager User Name</label>
                      <input [(ngModel)]="config.national.walksManager.userName"
                             id="walks-manager-user-name"
                             autocomplete="nope"
                             name="newPassword"
                             type="text" class="form-control input-sm"
                             placeholder="Enter Walks Manager userName">
                    </form>
                  </div>
                  <div class="col-md-4">
                    <form class="form-group">
                      <label for="walks-manager-password">Walks Manager password</label>
                      <input autocomplete="nope"
                             [(ngModel)]="config.national.walksManager.password"
                             type="text" class="form-control input-sm"
                             id="walks-manager-password"
                             name="password"
                             placeholder="Enter Walks Manager password">
                    </form>
                  </div>
                  <div class="col-md-3">
                    <form class="form-group">
                      <label for="walks-manager-api-key">Walks Manager API Key</label>
                      <input [(ngModel)]="config.national.walksManager.apiKey"
                             autocomplete="nope"
                             id="walks-manager-api-key"
                             name="apiKey"
                             type="text" class="form-control input-sm"
                             placeholder="Enter Walks Manager API key">
                    </form>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.EXTERNAL_SYSTEMS)}}"
                 [active]="tabActive(SystemSettingsTab.EXTERNAL_SYSTEMS)"
                 (selectTab)="selectTab(SystemSettingsTab.EXTERNAL_SYSTEMS)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-mail-provider-settings [config]="config"
                                            (membersPendingSave)="membersPendingSave=$event"/>
                <div class="row img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Instagram</div>
                  <div class="col-sm-12">
                    <div class="row align-items-end" *ngIf="config?.externalSystems.instagram">
                      <div class="col-md-6">
                        <div class="form-group">
                          <label for="instagram-href">Url</label>
                          <input [(ngModel)]="config.externalSystems.instagram.groupUrl"
                                 id="instagram-href"
                                 type="text" class="form-control input-sm"
                                 placeholder="Enter Instagram Group Url">
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="form-group">
                          <label for="instagram-group-name">Group Name</label>
                          <input [(ngModel)]="config.externalSystems.instagram.groupName"
                                 id="instagram-group-name"
                                 type="text" class="form-control input-sm"
                                 placeholder="Enter Instagram group name">
                        </div>
                      </div>
                      <div class="col-md-12">
                        <div class="form-group">
                          <label for="instagram-access-token">Access Token</label>
                          <input [(ngModel)]="config.externalSystems.instagram.accessToken"
                                 id="instagram-access-token"
                                 type="text" class="form-control input-sm"
                                 placeholder="Enter Instagram Access Token">
                        </div>
                      </div>
                      <div class="col-md-12">
                        <div class="form-group">
                          <div class="custom-control custom-checkbox">
                            <input [(ngModel)]="config.externalSystems.instagram.showFeed"
                                   type="checkbox" class="custom-control-input" id="instagram-show-feed">
                            <label class="custom-control-label"
                                   for="instagram-show-feed">Show Instagram Feed
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <app-system-meetup-settings/>
                <app-system-recaptcha-settings [config]="config"/>
                <app-system-google-analytics-settings [config]="config"/>
              </div>
            </tab>
          </tabset>
          <div *ngIf="notifyTarget.showAlert" class="row">
            <div class="col-sm-12 mb-10">
              <div class="alert {{notifyTarget.alert.class}}">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                <strong *ngIf="notifyTarget.alertTitle">
                  {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="col-sm-12">
            <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                   [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
            <input type="submit" value="Save" (click)="save()"
                   [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
            <input type="submit" value="Undo Changes" (click)="undoChanges()"
                   [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
            <input type="submit" value="Exit Without Saving" (click)="cancel()"
                   [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
          </div>
        </div>
      </div>
    </app-page>`,
})
export class SystemSettingsComponent implements OnInit, OnDestroy {

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public config: SystemConfig;
  public icons: RootFolder = RootFolder.icons;
  public logos: RootFolder = RootFolder.logos;
  public backgrounds: RootFolder = RootFolder.backgrounds;
  private subscriptions: Subscription[] = [];
  public populationMethods: KeyValue<string>[] = enumKeyValues(EventPopulation);
  public membersPendingSave: Member[] = [];
  private memberService: MemberService = inject(MemberService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private notifierService: NotifierService = inject(NotifierService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private broadcastService: BroadcastService<string> = inject(BroadcastService);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("SystemSettingsComponent", NgxLoggerLevel.ERROR);
  navbarLocations: KeyValue<string>[] = enumKeyValues(NavBarLocation);
  protected readonly colourSelectorsDarkLight = colourSelectorsDarkLight;
  protected readonly colourSelectors = colourSelectors;
  private tab: any;
  protected readonly SystemSettingsTab = SystemSettingsTab;
  protected readonly enumValueForKey = enumValueForKey;

  ngOnInit() {
    this.logger.info("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.debug("event received:", namedEvent);
      this.headerLogoChanged(namedEvent.data);
    });
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(SystemSettingsTab.GROUP_DETAILS);
      const tabParameter = params["tab"];
      const tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue, "selectTab:", tab);
      this.selectTab(tab);
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.info("retrieved config", config);
      }));
  }

  saveAndExit() {
    this.logger.info("saving config", this.config);
    this.save()
      .then((response) => {
        this.logger.info("config response:", response);
        this.urlService.navigateTo(["admin"]);
      });
  }

  undoChanges() {
    this.systemConfigService.refresh();
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notReady() {
    return !this.config;
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

  public selectTab(tab: SystemSettingsTab) {
    this.tab = tab;
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge",
      fragment: this.activatedRoute.snapshot.fragment
    });
  }

  tabActive(tab: SystemSettingsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

}
