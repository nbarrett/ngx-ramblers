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
import { NgClass, NgStyle } from "@angular/common";
import { SocialMediaLinksComponent } from "../../../footer/icons/footer-icons";

@Component({
    selector: "app-navbar",
    template: `
      <div [ngClass]="outerClasses()">
        <nav class="navbar navbar-expand-lg px-0">
          <div class="container px-0 d-flex align-items-center">
            <a class="navbar-brand"
               [class.me-0]="inlineNavBarVisible()"
               [class.ps-0]="inlineNavBarVisible()"
               [href]="urlService.baseUrl()" aria-current="page" target="_self">
              @if (logo?.awsFileName) {
                <img [src]="urlService.resourceRelativePathForAWSFileName(logo?.awsFileName)"
                     [alt]="systemConfig?.group?.shortName" [width]="logo?.width">
              }</a>
            <button type="button" aria-label="Toggle navigation"
                    class="navbar-toggler border-0 rounded-0 ms-auto"
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
            @if (inlineNavBarVisible()) {
              <div class="d-flex align-items-center ms-auto flex-grow-1 pe-0">
                <div class="d-flex justify-content-end flex-grow-1 pe-0">
                  <app-navbar-content class="flex-grow-1"/>
                </div>
                @if (rightPanelVisible()) {
                  <div class="ms-lg-3">
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
            } @else if (rightPanelVisible()) {
              <div class="ms-auto pt-2">
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
        </nav>
        @if (systemConfig?.header?.navBar?.location === NavBarLocation.BELOW_LOGO && !navbarContentWithinCollapse) {
          <div class="container">
            <app-navbar-content/>
          </div>
        }
      </div>
    `,
    imports: [SvgComponent, NavbarContentComponent, HeaderButtonsComponent, LoginPanelComponent, NgClass, NgStyle, SocialMediaLinksComponent]
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

  inlineNavBarVisible(): boolean {
    return !this.navbarContentWithinCollapse && this.systemConfig?.header?.navBar?.location !== NavBarLocation.BELOW_LOGO;
  }

  rightPanelVisible(): boolean {
    return !this.navbarContentWithinCollapse && this.systemConfig?.header?.rightPanel?.show;
  }

  outerClasses(): string {
    const classes: string[] = [];
    const configured = this.systemConfig?.header?.navBar?.class;
    if (configured) {
      classes.push(configured);
    } else {
      classes.push("bg-dark");
    }
    classes.push("navbar-shell-padding");
    return classes.join(" ");
  }
}
