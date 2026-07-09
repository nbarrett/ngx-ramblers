import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  colourSelectors,
  colourSelectorsDarkLight,
  ExternalSystemsSubTab,
  MediaSubTab,
  NavBarJustification,
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
import { isString, kebabCase } from "es-toolkit/compat";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { LinksEditComponent } from "../../../modules/common/links-edit/links-edit";
import { ColourSelectorComponent } from "../../banner/colour-selector";
import { SystemMeetupSettingsComponent } from "./external/system-meetup-settings";
import { SystemRecaptchaSettingsComponent } from "./external/system-recaptcha-settings";
import { SystemGoogleAnalyticsSettings } from "./google-analytics/system-google-analytics-settings";
import { SystemGoogleSearchConsoleSettings } from "./google-search-console/system-google-search-console-settings";
import { SystemOsMapsSettings } from "./os-maps/system-os-maps-settings";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { faFacebook, faInstagram, faLinkedin, faMeetup, faTwitter, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { faAdd, faPencil } from "@fortawesome/free-solid-svg-icons";
import { ImageCollectionSettingsComponent } from "./images/image-collection-settings";
import { AreaAndGroupSettingsComponent } from "./group/area-and-group-settings";
import { ImageSettings } from "./images/image-settings";
import { GlobalStyles } from "./styles/global-styles";
import { InstagramSettings } from "./external/system-instagram-settings";
import { RamblersSettings } from "./external/ramblers-settings";
import { SystemAreaMapSyncComponent } from "./area-map/system-area-map-sync";
import { SystemGoogleMapsSettingsComponent } from "./external/system-google-maps-settings";
import { FlickrSettings } from "./external/system-flickr-settings";
import { SystemCloudflareSettingsComponent } from "./external/system-cloudflare-settings";
import { SystemCloudflareWebAnalyticsSettings } from "./cloudflare-web-analytics/system-cloudflare-web-analytics-settings";
import { CloudflareWebAnalyticsDashboard } from "./cloudflare-web-analytics/cloudflare-web-analytics-dashboard";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { FooterLinkSetting } from "./footer-link-setting";
import { SalesforceSettings } from "./salesforce/salesforce-settings";
import { SalesforceConfigService } from "../../../services/salesforce/salesforce-config.service";
import { MemberSyncPolicySettings } from "./member-sync-policy/member-sync-policy-settings";
import { MemberSyncPolicyService } from "../../../services/member/member-sync-policy.service";
import { ScheduledTasksComponent } from "./scheduled-tasks/scheduled-tasks";
import { SystemMemorySettingsComponent } from "./diagnostics/system-memory-settings";


@Component({
    selector: "app-system-settings",
    template: `
      <app-page autoTitle>
        <div class="row">
          <div class="col-sm-12">
            @if (config) {
              <tabset class="custom-tabset">
                <tab app-area-and-group-settings
                     heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.AREA_AND_GROUP)}}"
                     [config]="config"
                     [active]="tabActive(SystemSettingsTab.AREA_AND_GROUP)"
                     (selectTab)="selectTab(SystemSettingsTab.AREA_AND_GROUP)"/>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.MEDIA)}}"
                     [active]="tabActive(SystemSettingsTab.MEDIA)"
                     (selectTab)="selectTab(SystemSettingsTab.MEDIA)">
                  <app-section-toggle
                    [tabs]="mediaSubTabs"
                    [(selectedTab)]="mediaSubTab"
                    [queryParamKey]="StoredValue.MEDIA_SUB_TAB"/>
                  @if (mediaSubTab === MediaSubTab.BACKGROUNDS) {
                    <div app-image-collection-settings
                         [rootFolder]="backgrounds"
                         [config]="config"
                         [images]="config.backgrounds"></div>
                  }
                  @if (mediaSubTab === MediaSubTab.ICONS) {
                    <div app-image-collection-settings
                         [rootFolder]="icons"
                         [config]="config"
                         [images]="config.icons"></div>
                  }
                  @if (mediaSubTab === MediaSubTab.LOGOS) {
                    <div app-image-collection-settings
                         [rootFolder]="logos"
                         [config]="config"
                         [images]="config.logos"></div>
                  }
                  @if (mediaSubTab === MediaSubTab.IMAGES) {
                    <div app-image-settings [config]="config"></div>
                  }
                </tab>
                <tab app-global-styles
                     heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.STYLES)}}"
                     [config]="config"
                     [active]="tabActive(SystemSettingsTab.STYLES)"
                     (selectTab)="selectTab(SystemSettingsTab.STYLES)"/>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.WEBSITE_HEADER)}}"
                     [active]="tabActive(SystemSettingsTab.WEBSITE_HEADER)"
                     (selectTab)="selectTab(SystemSettingsTab.WEBSITE_HEADER)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-links-edit heading="Header Buttons" [links]="config.header.navigationButtons"/>
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Header Bar</div>
                      <div class="row">
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.headerBar.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-header-bar">
                            <label class="form-check-label"
                                   for="show-header-bar">Show
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.headerBar.showLoginLinksAndSiteEdit"
                                   [disabled]="!config.header.headerBar.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-header-bar-login-links-and-site-edit">
                            <label class="form-check-label"
                                   for="show-header-bar-login-links-and-site-edit">Show Login
                              Links and Site Edit
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.headerBar.showNavigationButtons"
                                   [disabled]="!config.header.headerBar.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-header-bar-buttons">
                            <label class="form-check-label"
                                   for="show-header-bar-buttons">Show Header Buttons
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Header Right Panel</div>
                      <div class="row">
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-right-panel">
                            <label class="form-check-label"
                                   for="show-right-panel">Show
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.rightPanel.showNavigationButtons"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-header-buttons">
                            <label class="form-check-label"
                                   for="show-header-buttons">Show Header Buttons
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.rightPanel.showLoginLinksAndSiteEdit"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-login-links-and-site-edit">
                            <label class="form-check-label"
                                   for="show-login-links-and-site-edit">Show Login Links and
                              Site Edit
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check mb-3">
                            <input [(ngModel)]="config.header.rightPanel.socialMediaLinks.show"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input"
                                   id="show-social-media-links">
                            <label class="form-check-label"
                                   for="show-social-media-links">Show Social Media Links
                            </label>
                          </div>
                          <div class="row">
                            <div class="col-md-6">
                              <label for="social-mediaLinks-width">Width</label>
                              <input [(ngModel)]="config.header.rightPanel.socialMediaLinks.width"
                                     [disabled]="!config.header.rightPanel.socialMediaLinks.show"
                                     id="social-mediaLinks-width"
                                     type="number" class="form-control">
                            </div>
                            <div class="col-md-6">
                              <label>Colour</label>
                              <app-colour-selector
                                [itemWithClassOrColour]="config.header.rightPanel.socialMediaLinks"
                                [disabled]="!config.header.rightPanel.socialMediaLinks.show"
                                [colours]="colourSelectors" noLabel/>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Navbar</div>
                      <div class="row">
                        <div class="col-sm-4">
                          <label for="navbar-location">Navbar Location</label>
                          <select class="form-control input-sm"
                                  [(ngModel)]="config.header.navBar.location"
                                  id="navbar-location">
                            @for (type of navbarLocations; track type.key) {
                              <option [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                              </option>
                            }
                          </select>
                        </div>
                        <div class="col-sm-4">
                          <label for="navbar-justification">Navbar Justification</label>
                          <select class="form-control input-sm"
                                  [(ngModel)]="config.header.navBar.justification"
                                  id="navbar-justification">
                            @for (type of navbarJustifications; track type.key) {
                              <option [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                              </option>
                            }
                          </select>
                        </div>
                        <div class="col-sm-4">
                          <app-colour-selector [itemWithClassOrColour]="config.header.navBar"
                                               [colours]="colourSelectorsDarkLight"
                                               label="Navbar Colour"/>
                        </div>
                      </div>
                    </div>
                    <app-links-edit [heading]='"Pages Within Navbar"' [links]="config.group.pages"/>
                  </div>
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.WEBSITE_FOOTER)}}"
                     [active]="tabActive(SystemSettingsTab.WEBSITE_FOOTER)"
                     (selectTab)="selectTab(SystemSettingsTab.WEBSITE_FOOTER)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row thumbnail-heading-frame">
                      <div class="thumbnail-heading">Column 1: External Urls</div>
                      <div class="col-md-12">
                        @for (link of footerLinks; track link.key; let last = $last) {
                          <app-footer-link-setting [name]="link.name" [title]="link.title"
                                                   [icon]="link.icon"
                                                   [externalSystem]="config.externalSystems[link.key]">
                            @if (link.key === "facebook") {
                              <div class="form-check">
                                <input [(ngModel)]="config.externalSystems.facebook.showFeed"
                                       type="checkbox" class="form-check-input" id="facebook-show-feed">
                                <label class="form-check-label"
                                       for="facebook-show-feed">Show Facebook Feed
                                </label>
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
                            }
                          </app-footer-link-setting>
                          @if (!last) {
                            <hr>
                          }
                        }
                      </div>
                    </div>
                    <app-links-edit [heading]='"Column 2: Quick Links"'
                                    [links]="config.footer.quickLinks"/>
                    <app-links-edit [heading]='"Column 3: Legals"' [links]="config.footer.legals"/>
                    <div class="row thumbnail-heading-frame">
                      <div class="thumbnail-heading">Column 4: Download Links</div>
                      <div class="col-sm-12">
                        <div class="form-group">
                          <label for="app-download-apple-url">Apple</label>
                          <input [(ngModel)]="config.footer.appDownloads.apple"
                                 id="app-download-apple-url"
                                 class="form-control input-sm">
                          <div class="form-check mt-2">
                            <input [(ngModel)]="config.footer.appDownloads.appleShowInFooter"
                                   type="checkbox" class="form-check-input"
                                   id="app-download-apple-show-in-footer">
                            <label class="form-check-label"
                                   for="app-download-apple-show-in-footer">Show in footer</label>
                          </div>
                        </div>
                        <div class="form-group">
                          <label for="app-download-google-url">Google</label>
                          <input [(ngModel)]="config.footer.appDownloads.google"
                                 id="app-download-google-url"
                                 class="form-control input-sm">
                          <div class="form-check mt-2">
                            <input [(ngModel)]="config.footer.appDownloads.googleShowInFooter"
                                   type="checkbox" class="form-check-input"
                                   id="app-download-google-show-in-footer">
                            <label class="form-check-label"
                                   for="app-download-google-show-in-footer">Show in footer</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.MAPS)}}"
                     [active]="tabActive(SystemSettingsTab.MAPS)"
                     (selectTab)="selectTab(SystemSettingsTab.MAPS)">
                  @if (mapsTabActivated) {
                    <app-area-map-sync-settings [config]="config" [tabActive]="tabActive(SystemSettingsTab.MAPS)" (busyChange)="areaMapSyncBusy=$event"/>
                  }
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.EXTERNAL_SYSTEMS)}}"
                     [active]="tabActive(SystemSettingsTab.EXTERNAL_SYSTEMS)"
                     (selectTab)="selectTab(SystemSettingsTab.EXTERNAL_SYSTEMS)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-section-toggle
                      [tabs]="externalSystemSubTabs"
                      [(selectedTab)]="externalSystemSubTab"
                      [queryParamKey]="StoredValue.SUB_TAB"
                      [fullWidth]="true"/>
                    @if (showSubTab(ExternalSystemsSubTab.RAMBLERS)) {
                        <app-ramblers-settings [config]="config" (syncingChange)="walksManagerSyncBusy=$event"/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.SOCIAL)) {
                        <app-system-instagram-settings/>
                        <app-system-flickr-settings/>
                        <app-system-meetup-settings/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.MAPS)) {
                        <app-system-os-maps-settings [config]="config"/>
                        <app-system-google-maps-settings [config]="config"/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.SALESFORCE)) {
                        <app-salesforce-settings/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.MEMBER_SYNC_POLICY)) {
                        <app-member-sync-policy-settings/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.CLOUDFLARE)) {
                        <app-system-cloudflare-settings/>
                        <app-system-cloudflare-web-analytics-settings [config]="config"/>
                        <app-cloudflare-web-analytics-dashboard [siteTag]="config.cloudflareWebAnalytics?.siteTag"/>
                    }
                    @if (showSubTab(ExternalSystemsSubTab.SECURITY)) {
                        <app-system-recaptcha-settings [config]="config"/>
                        <app-system-google-analytics-settings [config]="config"/>
                        <app-system-google-search-console-settings [config]="config"/>
                    }
                  </div>
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.SCHEDULED_TASKS)}}"
                     [active]="tabActive(SystemSettingsTab.SCHEDULED_TASKS)"
                     (selectTab)="selectTab(SystemSettingsTab.SCHEDULED_TASKS)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-scheduled-tasks/>
                  </div>
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.DIAGNOSTICS)}}"
                     [active]="tabActive(SystemSettingsTab.DIAGNOSTICS)"
                     (selectTab)="selectTab(SystemSettingsTab.DIAGNOSTICS)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-system-memory-settings/>
                  </div>
                </tab>
              </tabset>
            }
            @if (notifyTarget.showAlert) {
              <div class="row">
                <div class="col-sm-12 mb-10">
                  <div class="alert {{notifyTarget.alert.class}}">
                    <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                    @if (notifyTarget.alertTitle) {
                      <strong>
                        {{ notifyTarget.alertTitle }}: </strong>
                    } {{ notifyTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="col-sm-12">
            <div class="col-sm-12">
              <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                     [ngClass]="notReady() || areaMapSyncBusy || walksManagerSyncBusy ? 'btn btn-secondary me-2': 'btn btn-success me-2'"
                     [disabled]="notReady() || areaMapSyncBusy || walksManagerSyncBusy">
              <input type="submit" value="Save" (click)="save()"
                     [ngClass]="notReady() || areaMapSyncBusy || walksManagerSyncBusy ? 'btn btn-secondary me-2': 'btn btn-success me-2'"
                     [disabled]="notReady() || areaMapSyncBusy || walksManagerSyncBusy">
              <input type="submit" value="Undo Changes" (click)="undoChanges()"
                     [ngClass]="notReady() || areaMapSyncBusy || walksManagerSyncBusy ? 'btn btn-secondary me-2': 'btn btn-primary me-2'"
                     [disabled]="notReady() || areaMapSyncBusy || walksManagerSyncBusy">
              <input type="submit" value="Exit Without Saving" (click)="cancel()"
                     [ngClass]="notReady() || areaMapSyncBusy || walksManagerSyncBusy ? 'btn btn-secondary me-2': 'btn btn-primary me-2'"
                     [disabled]="notReady() || areaMapSyncBusy || walksManagerSyncBusy">
            </div>
          </div>
        </div>
      </app-page>`,
  imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, LinksEditComponent, ImageSettings, ColourSelectorComponent, InstagramSettings, FlickrSettings, SystemRecaptchaSettingsComponent, SystemGoogleAnalyticsSettings, SystemGoogleSearchConsoleSettings, SystemOsMapsSettings, SystemGoogleMapsSettingsComponent, FontAwesomeModule, NgClass, AreaAndGroupSettingsComponent, ImageSettings, ImageCollectionSettingsComponent, RamblersSettings, InstagramSettings, SystemMeetupSettingsComponent, RamblersSettings, GlobalStyles, SystemAreaMapSyncComponent, SectionToggle, SystemCloudflareSettingsComponent, SystemCloudflareWebAnalyticsSettings, CloudflareWebAnalyticsDashboard, FooterLinkSetting, SalesforceSettings, MemberSyncPolicySettings, ScheduledTasksComponent, SystemMemorySettingsComponent]
})
export class SystemSettingsComponent implements OnInit, OnDestroy {

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public config: SystemConfig;
  public icons: RootFolder = RootFolder.icons;
  public logos: RootFolder = RootFolder.logos;
  public backgrounds: RootFolder = RootFolder.backgrounds;
  private subscriptions: Subscription[] = [];
  public areaMapSyncBusy = false;
  public walksManagerSyncBusy = false;
  protected mapsTabActivated = false;
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private salesforceConfigService: SalesforceConfigService = inject(SalesforceConfigService);
  private memberSyncPolicyService: MemberSyncPolicyService = inject(MemberSyncPolicyService);
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
  navbarJustifications: KeyValue<string>[] = enumKeyValues(NavBarJustification);
  protected readonly colourSelectorsDarkLight = colourSelectorsDarkLight;
  protected readonly colourSelectors = colourSelectors;
  private tab: SystemSettingsTab = SystemSettingsTab.AREA_AND_GROUP;
  protected readonly StoredValue = StoredValue;
  protected readonly SystemSettingsTab = SystemSettingsTab;
  protected readonly ExternalSystemsSubTab = ExternalSystemsSubTab;
  protected readonly MediaSubTab = MediaSubTab;
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly faAdd = faAdd;
  protected readonly faPencil = faPencil;
  footerLinks = [
    {key: "facebook", name: "facebook", title: "Facebook", icon: faFacebook},
    {key: "meetup", name: "meetup", title: "Meetup", icon: faMeetup},
    {key: "youtube", name: "youtube", title: "Youtube", icon: faYoutube},
    {key: "twitter", name: "twitter", title: "Twitter", icon: faTwitter},
    {key: "linkedIn", name: "linkedin", title: "LinkedIn", icon: faLinkedin},
    {key: "instagram", name: "instagram", title: "Instagram", icon: faInstagram}
  ];
  externalSystemSubTab = ExternalSystemsSubTab.ALL;
  mediaSubTab = MediaSubTab.BACKGROUNDS;
  mediaSubTabs: SectionToggleTab[] = [
    {value: MediaSubTab.BACKGROUNDS, label: "Backgrounds"},
    {value: MediaSubTab.ICONS, label: "Icons"},
    {value: MediaSubTab.LOGOS, label: "Logos"},
    {value: MediaSubTab.IMAGES, label: "Images"}
  ];
  externalSystemSubTabs: SectionToggleTab[] = [
    {value: ExternalSystemsSubTab.ALL, label: "All"},
    {value: ExternalSystemsSubTab.RAMBLERS, label: "Ramblers"},
    {value: ExternalSystemsSubTab.SOCIAL, label: "Social Media"},
    {value: ExternalSystemsSubTab.MAPS, label: "Maps"},
    {value: ExternalSystemsSubTab.SALESFORCE, label: "Salesforce"},
    {value: ExternalSystemsSubTab.MEMBER_SYNC_POLICY, label: "Member Sync Policy"},
    {value: ExternalSystemsSubTab.CLOUDFLARE, label: "Cloudflare"},
    {value: ExternalSystemsSubTab.SECURITY, label: "Security"}
  ];

  ngOnInit() {
    this.logger.info("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.salesforceConfigService.refresh();
    this.memberSyncPolicyService.refresh();
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.debug("event received:", namedEvent);
      this.headerLogoChanged(namedEvent.data);
    });
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(SystemSettingsTab.AREA_AND_GROUP);
      const tabParameter = params[StoredValue.TAB];
      const tab = tabParameter || defaultValue;
      const mediaSubTab = this.legacyMediaSubTab(tab);
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue, "selectTab:", tab);
      if (mediaSubTab) {
        this.mediaSubTab = mediaSubTab;
        this.tab = SystemSettingsTab.MEDIA;
      } else {
        this.tab = tab as SystemSettingsTab;
      }
      if (this.tabActive(SystemSettingsTab.MAPS)) {
        this.mapsTabActivated = true;
      }
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.ensureExternalSystemsInitialised();
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
    this.salesforceConfigService.refresh();
    this.memberSyncPolicyService.refresh();
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notReady() {
    return !this.config;
  }

  ensureExternalSystemsInitialised() {
    if (this.config?.externalSystems) {
      const defaultExternalSystem = {groupUrl: "", showFooterLink: false, showFeed: false};
      if (!this.config.externalSystems.facebook || isString(this.config.externalSystems.facebook)) {
        this.config.externalSystems.facebook = {appId: null, pagesUrl: null, ...defaultExternalSystem};
      }
      if (!this.config.externalSystems.instagram || isString(this.config.externalSystems.instagram)) {
        this.config.externalSystems.instagram = {accessToken: null, groupName: null, ...defaultExternalSystem};
      }
      if (!this.config.externalSystems.meetup || isString(this.config.externalSystems.meetup)) {
        this.config.externalSystems.meetup = {groupName: null, ...defaultExternalSystem};
      }
      if (!this.config.externalSystems.youtube || isString(this.config.externalSystems.youtube)) {
        this.config.externalSystems.youtube = {...defaultExternalSystem};
      }
      if (!this.config.externalSystems.twitter || isString(this.config.externalSystems.twitter)) {
        this.config.externalSystems.twitter = {...defaultExternalSystem};
      }
      if (!this.config.externalSystems.linkedIn || isString(this.config.externalSystems.linkedIn)) {
        this.config.externalSystems.linkedIn = {...defaultExternalSystem};
      }
    }
  }

  async save() {
    this.logger.debug("saving config", this.config);
    await this.systemConfigService.saveConfig(this.config)
      .catch((error) => this.notify.error({title: "Error saving system config", message: error}));
    if (this.salesforceConfigService.hasLoaded()) {
      await this.salesforceConfigService.save(this.salesforceConfigService.cached())
        .catch((error) => this.notify.error({title: "Error saving Salesforce config", message: error}));
    }
    if (this.memberSyncPolicyService.hasLoaded()) {
      await this.memberSyncPolicyService.save(this.memberSyncPolicyService.cached())
        .catch((error) => this.notify.error({title: "Error saving member sync policy", message: error}));
    }
  }

  cancel() {
    this.systemConfigService.refresh();
    this.salesforceConfigService.refresh();
    this.memberSyncPolicyService.refresh();
    this.urlService.navigateTo(["admin"]);
  }

  headerLogoChanged(logo: string) {
    if (this.config?.header) {
      this.config.header.selectedLogo = logo;
    }
  }

  public selectTab(tab: SystemSettingsTab) {
    if (this.walksManagerSyncBusy) {
      return;
    }
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

  showSubTab(tab: ExternalSystemsSubTab): boolean {
    return [ExternalSystemsSubTab.ALL, tab].includes(this.externalSystemSubTab as ExternalSystemsSubTab);
  }

  private legacyMediaSubTab(tab: string): MediaSubTab | null {
    let mediaSubTab: MediaSubTab | null = null;
    if (tab === kebabCase(SystemSettingsTab.BACKGROUNDS)) {
      mediaSubTab = MediaSubTab.BACKGROUNDS;
    } else if (tab === kebabCase(SystemSettingsTab.ICONS)) {
      mediaSubTab = MediaSubTab.ICONS;
    } else if (tab === kebabCase(SystemSettingsTab.LOGOS)) {
      mediaSubTab = MediaSubTab.LOGOS;
    } else if (tab === kebabCase(SystemSettingsTab.IMAGES)) {
      mediaSubTab = MediaSubTab.IMAGES;
    }
    return mediaSubTab;
  }
}
