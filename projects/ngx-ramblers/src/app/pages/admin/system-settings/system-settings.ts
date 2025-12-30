import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  colourSelectors,
  colourSelectorsDarkLight,
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
import { Member } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";
import { kebabCase } from "es-toolkit/compat";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { LinksEditComponent } from "../../../modules/common/links-edit/links-edit";
import { ColourSelectorComponent } from "../../banner/colour-selector";
import { MailProviderSettingsComponent } from "./mail-provider/mail-provider-settings";
import { SystemMeetupSettingsComponent } from "./external/system-meetup-settings";
import { SystemRecaptchaSettingsComponent } from "./external/system-recaptcha-settings";
import { SystemGoogleAnalyticsSettings } from "./google-analytics/system-google-analytics-settings";
import { SystemOsMapsSettings } from "./os-maps/system-os-maps-settings";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { faAdd, faPencil } from "@fortawesome/free-solid-svg-icons";
import { ImageCollectionSettingsComponent } from "./images/image-collection-settings";
import { AreaAndGroupSettingsComponent } from "./group/area-and-group-settings";
import { ImageSettings } from "./images/image-settings";
import { GlobalStyles } from "./styles/global-styles";
import { InstagramSettings } from "./external/system-instagram-settings";
import { RamblersSettings } from "./external/ramblers-settings";
import { SystemAreaMapSyncComponent } from "./area-map/system-area-map-sync";

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
                <tab app-image-collection-settings
                     heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.BACKGROUNDS)}}"
                     [active]="tabActive(SystemSettingsTab.BACKGROUNDS)"
                     (selectTab)="selectTab(SystemSettingsTab.BACKGROUNDS)"
                     [rootFolder]="backgrounds"
                     [config]="config"
                     [images]="config.backgrounds"/>
                <tab app-image-collection-settings
                     heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.ICONS)}}"
                     [active]="tabActive(SystemSettingsTab.ICONS)"
                     (selectTab)="selectTab(SystemSettingsTab.ICONS)"
                     [rootFolder]="icons"
                     [config]="config"
                     [images]="config.icons"/>
                <tab app-image-collection-settings
                     heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.LOGOS)}}"
                     [active]="tabActive(SystemSettingsTab.LOGOS)"
                     (selectTab)="selectTab(SystemSettingsTab.LOGOS)"
                     [rootFolder]="logos"
                     [config]="config"
                     [images]="config.logos"/>
                <tab app-image-settings heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.IMAGES)}}"
                     [config]="config"
                     [active]="tabActive(SystemSettingsTab.IMAGES)"
                     (selectTab)="selectTab(SystemSettingsTab.IMAGES)"/>
                <tab app-global-styles heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.STYLES)}}"
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
                                   type="checkbox" class="form-check-input" id="show-header-bar">
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
                                   for="show-header-bar-login-links-and-site-edit">Show Login Links and Site Edit
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.headerBar.showNavigationButtons"
                                   [disabled]="!config.header.headerBar.show"
                                   type="checkbox" class="form-check-input" id="show-header-bar-buttons">
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
                                   type="checkbox" class="form-check-input" id="show-right-panel">
                            <label class="form-check-label"
                                   for="show-right-panel">Show
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.rightPanel.showNavigationButtons"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input" id="show-header-buttons">
                            <label class="form-check-label"
                                   for="show-header-buttons">Show Header Buttons
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check">
                            <input [(ngModel)]="config.header.rightPanel.showLoginLinksAndSiteEdit"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input" id="show-login-links-and-site-edit">
                            <label class="form-check-label"
                                   for="show-login-links-and-site-edit">Show Login Links and Site Edit
                            </label>
                          </div>
                        </div>
                        <div class="col-md-12">
                          <div class="form-check mb-3">
                            <input [(ngModel)]="config.header.rightPanel.socialMediaLinks.show"
                                   [disabled]="!config.header.rightPanel.show"
                                   type="checkbox" class="form-check-input" id="show-social-media-links">
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
                              <app-colour-selector [itemWithClassOrColour]="config.header.rightPanel.socialMediaLinks"
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
                        <div class="form-check">
                          <input [(ngModel)]="config.externalSystems.facebook.showFeed"
                                 type="checkbox" class="form-check-input" id="facebook-show-feed">
                          <label class="form-check-label"
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
                            <div class="form-check">
                              <input [(ngModel)]="config.externalSystems.meetup.showFooterLink"
                                     type="checkbox" class="form-check-input" id="meetup-show-footer-link">
                              <label class="form-check-label"
                                     for="meetup-show-footer-link">Show Meetup
                              </label>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <div class="d-inline-flex align-items-center flex-wrap">
                              <label>Meetup Link Preview:</label>
                              <a class="ms-2"
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
                            <div class="form-check">
                              <input [(ngModel)]="config.externalSystems.instagram.showFooterLink"
                                     type="checkbox" class="form-check-input" id="instagram-show-footer-link">
                              <label class="form-check-label"
                                     for="instagram-show-footer-link">Show Instagram
                              </label>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <div class="d-inline-flex align-items-center flex-wrap">
                              <label>Instagram Link Preview:</label>
                              <a class="ms-2"
                                 [href]="config.externalSystems.instagram.groupUrl+'/'+config.externalSystems.instagram.groupName">{{ config.externalSystems.instagram.groupName }}</a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <app-links-edit [heading]='"Column 2: Quick Links"'
                                    [links]="config.footer.quickLinks"/>
                    <app-links-edit [heading]='"Column 3: Legals"' [links]="config.footer.legals"/>
                    <div class="row thumbnail-heading-frame">
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
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.AREA_MAP_SYNC)}}"
                     [active]="tabActive(SystemSettingsTab.AREA_MAP_SYNC)"
                     (selectTab)="selectTab(SystemSettingsTab.AREA_MAP_SYNC)">
                  <app-area-map-sync-settings [config]="config" (busyChange)="areaMapSyncBusy=$event"/>
                </tab>
                <tab heading="{{enumValueForKey(SystemSettingsTab, SystemSettingsTab.EXTERNAL_SYSTEMS)}}"
                     [active]="tabActive(SystemSettingsTab.EXTERNAL_SYSTEMS)"
                     (selectTab)="selectTab(SystemSettingsTab.EXTERNAL_SYSTEMS)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-ramblers-settings [config]="config"/>
                    <app-mail-provider-settings [config]="config"
                                                (membersPendingSave)="membersPendingSave=$event"/>
                    <app-system-instagram-settings/>
                    <app-system-meetup-settings/>
                    <app-system-os-maps-settings [config]="config"/>
                    <app-system-recaptcha-settings [config]="config"/>
                    <app-system-google-analytics-settings [config]="config"/>
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
                     [ngClass]="notReady() || areaMapSyncBusy ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady() || areaMapSyncBusy">
              <input type="submit" value="Save" (click)="save()"
                     [ngClass]="notReady() || areaMapSyncBusy ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady() || areaMapSyncBusy">
              <input type="submit" value="Undo Changes" (click)="undoChanges()"
                     [ngClass]="notReady() || areaMapSyncBusy ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady() || areaMapSyncBusy">
              <input type="submit" value="Exit Without Saving" (click)="cancel()"
                     [ngClass]="notReady() || areaMapSyncBusy ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady() || areaMapSyncBusy">
            </div>
          </div>
        </div>
      </app-page>`,
  imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, LinksEditComponent, ImageSettings, ColourSelectorComponent, MailProviderSettingsComponent, InstagramSettings, SystemRecaptchaSettingsComponent, SystemGoogleAnalyticsSettings, SystemOsMapsSettings, FontAwesomeModule, NgClass, AreaAndGroupSettingsComponent, ImageSettings, ImageCollectionSettingsComponent, RamblersSettings, InstagramSettings, SystemMeetupSettingsComponent, RamblersSettings, GlobalStyles, SystemAreaMapSyncComponent]
})
export class SystemSettingsComponent implements OnInit, OnDestroy {

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public config: SystemConfig;
  public icons: RootFolder = RootFolder.icons;
  public logos: RootFolder = RootFolder.logos;
  public backgrounds: RootFolder = RootFolder.backgrounds;
  private subscriptions: Subscription[] = [];
  public membersPendingSave: Member[] = [];
  public areaMapSyncBusy = false;
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
  navbarJustifications: KeyValue<string>[] = enumKeyValues(NavBarJustification);
  protected readonly colourSelectorsDarkLight = colourSelectorsDarkLight;
  protected readonly colourSelectors = colourSelectors;
  private tab: SystemSettingsTab = SystemSettingsTab.AREA_AND_GROUP;
  protected readonly SystemSettingsTab = SystemSettingsTab;
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly faAdd = faAdd;
  protected readonly faPencil = faPencil;

  ngOnInit() {
    this.logger.info("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.debug("event received:", namedEvent);
      this.headerLogoChanged(namedEvent.data);
    });
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(SystemSettingsTab.AREA_AND_GROUP);
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
