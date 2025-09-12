import { Component, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  classBackgroundDark,
  Image,
  NavBarLocation,
  rgbColourCloudy,
  rgbColourGranite,
  SystemConfig
} from "../../../models/system.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { SvgComponent } from "../svg/svg";
import { NavbarContentComponent } from "../navbar-content/navbar-content";
import { HeaderButtonsComponent } from "../../../header-buttons/header-buttons";
import { LoginPanelComponent } from "../../../login-panel/login-panel.component";
import { NgStyle } from "@angular/common";
import { SocialMediaLinksComponent } from "../../../footer/icons/footer-icons";

@Component({
    selector: "app-navbar",
    template: `
      <div class="{{systemConfig?.header?.navBar?.class}}">
        <div class="row d-flex align-items-stretch">
          <div class="px-sm-2 ms-lg-3 col">
            <nav class="navbar navbar-expand-lg">
              <a class="navbar-brand" [href]="urlService.baseUrl()" aria-current="page" target="_self">
                @if (logo?.awsFileName) {
                  <img [src]="urlService.resourceRelativePathForAWSFileName(logo?.awsFileName)"
                       [alt]="systemConfig?.group?.shortName" [width]="logo?.width">
                }</a>
              <button type="button" aria-label="Toggle navigation"
                      class="navbar-toggler border-0 rounded-0"
                      [attr.aria-expanded]="navbarExpanded"
                      (click)="toggleNavBar()">
                <app-svg [height]="27"
                         [width]="27"
                         [colour]="systemConfig?.header?.navBar?.class==classBackgroundDark?colourCloudy:colourGranite"
                         [icon]="icon()"/>
              </button>
              @if (navbarContentWithinCollapse && navbarExpanded) {
                <div class="navbar-collapse" [class.show]="navbarExpanded">
                  <app-navbar-content/>
                </div>
              }
              @if (!navbarContentWithinCollapse && systemConfig?.header?.navBar?.location !== NavBarLocation.BELOW_LOGO) {
                <app-navbar-content/>
              }
            </nav>
          </div>
          @if (!navbarContentWithinCollapse && systemConfig?.header?.rightPanel?.show) {
            <div class="p-0 col-auto pt-3 pe-4">
              @if (systemConfig?.header?.rightPanel?.showNavigationButtons) {
                <app-header-buttons/>
              }
              @if (systemConfig?.header?.rightPanel?.showLoginLinksAndSiteEdit) {
                <app-login-panel/>
              }
              @if (systemConfig?.header?.rightPanel?.socialMediaLinks?.show) {
                <div class="float-end me-2"
                     [ngStyle]="{'width.px': systemConfig?.header?.rightPanel?.socialMediaLinks?.width}">
                  <app-social-media-links [colour]="systemConfig?.header?.rightPanel?.socialMediaLinks?.colour"/>
                </div>
              }
            </div>
          }
        </div>
        @if (systemConfig?.header?.navBar?.location === NavBarLocation.BELOW_LOGO) {
          <div class="row">
            <div class="p-0 col">
              @if (!navbarContentWithinCollapse) {
                <app-navbar-content/>
              }
            </div>
          </div>
        }
      </div>
    `,
    styleUrls: ["./navbar.sass"],
    imports: [SvgComponent, NavbarContentComponent, HeaderButtonsComponent, LoginPanelComponent, NgStyle, SocialMediaLinksComponent]
})
export class NavbarComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("NavbarComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  urlService = inject(UrlService);
  public navbarContentWithinCollapse: boolean;
  public logo: Image;
  public navbarExpanded = false;
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];

  protected readonly NavBarLocation = NavBarLocation;
  protected readonly colourCloudy = rgbColourCloudy;

  protected readonly colourGranite = rgbColourGranite;
  protected readonly classBackgroundDark = classBackgroundDark;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    const width = event?.target?.innerWidth;
    this.detectWidth(width);
  }

  private detectWidth(width: number) {
    this.navbarContentWithinCollapse = width < 980;
    this.logger.info("detectWidth:", width, "this.navbarContentWithinCollapse:", this.navbarContentWithinCollapse);
  }

  toggleNavBar() {
    this.logger.info("navbarExpanded to:", !this.navbarExpanded);
    this.navbarExpanded = !this.navbarExpanded;
  }

  ngOnInit(): void {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.systemConfig = systemConfig;
      this.logger.info("received:", systemConfig);
      this.selectActiveLogo(this.systemConfig?.header?.selectedLogo);
    }));
    this.broadcastService.on(NamedEventType.DEFAULT_LOGO_CHANGED, (namedEvent: NamedEvent<string>) => {
      this.logger.info("event received:", namedEvent);
      this.selectActiveLogo(namedEvent.data);
    });

    this.broadcastService.on(NamedEventType.MENU_TOGGLE, (event: NamedEvent<boolean>) => {
      this.logger.info("menu toggled with event:", event);
      this.navbarExpanded = event.data;
    });
    this.detectWidth(window.innerWidth);
  }

  private selectActiveLogo(activeLogo: string) {
    this.logo = this.systemConfig?.logos?.images?.find(logo => logo.originalFileName === activeLogo);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  icon() {
    return this.navbarExpanded ? "i-cross" : "i-menu";
  }
}
