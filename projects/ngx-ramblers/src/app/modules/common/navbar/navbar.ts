import { AfterViewInit, Component, ElementRef, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { DOCUMENT } from "@angular/common";
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
import { SiteSearchComponent } from "../site-search/site-search";
import { NavbarContentComponent } from "../navbar-content/navbar-content";
import { HeaderButtonsComponent } from "../../../header-buttons/header-buttons";
import { LoginPanelComponent } from "../../../login-panel/login-panel.component";
import { NgClass, NgStyle } from "@angular/common";
import { SocialMediaLinksComponent } from "../../../footer/icons/footer-icons";

@Component({
    selector: "app-navbar",
    host: {"[class.mobile-menu-open]": "navbarContentWithinCollapse && navbarExpanded"},
    template: `
      <div [ngClass]="outerClasses()">
        <nav class="navbar navbar-expand-lg px-0">
          <div class="container navbar-container d-flex align-items-center">
            <div class="brand-search-wrap">
              <a class="navbar-brand"
                 [class.me-0]="inlineNavBarVisible()"
                 [class.ps-0]="inlineNavBarVisible()"
                 [href]="urlService.baseUrl()" aria-current="page" target="_self">
                @if (logo?.awsFileName) {
                  <img [src]="urlService.imageSource(logo?.awsFileName, true)"
                       [alt]="systemConfig?.group?.shortName" [width]="logo?.width"
                       (load)="publishNavbarHeight()">
                }</a>
              @if (!belowLogoInline()) {
                <app-site-search class="site-search-anchored"
                                 [style.color]="systemConfig?.header?.navBar?.class===classBackgroundDark?colourCloudy:colourGranite"/>
              }
            </div>
            <button type="button" aria-label="Toggle navigation"
                    class="navbar-toggler border-0 rounded-0"
                    [attr.aria-expanded]="navbarExpanded"
                    (click)="toggleNavBar()">
              <app-svg [height]="24"
                       [width]="24"
                       [colour]="systemConfig?.header?.navBar?.class==classBackgroundDark?colourCloudy:colourGranite"
                       [icon]="icon()"/>
            </button>
            @if (navbarContentWithinCollapse && navbarExpanded) {
              <div class="navbar-collapse" [class.show]="navbarExpanded">
                <app-navbar-content/>
              </div>
            }
            @if (inlineNavBarVisible()) {
              <div class="d-flex align-items-center ms-auto flex-grow-1 pe-0 navbar-inline-content">
                <div class="d-flex justify-content-end flex-grow-1 pe-0 navbar-inline-menu">
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
          <div class="container d-flex align-items-center">
            <app-navbar-content class="flex-grow-1"/>
            <app-site-search class="site-search-anchored"
                             [style.color]="systemConfig?.header?.navBar?.class===classBackgroundDark?colourCloudy:colourGranite"/>
          </div>
        }
      </div>
    `,
    styles: [`
@media (min-width: 992px)
  .navbar-container
    padding-inline: 0
  nav.navbar
    flex-wrap: nowrap
  .navbar-inline-content, .navbar-inline-menu
    min-width: 0
  .container
    flex-wrap: nowrap
    min-width: 0
    overflow: visible

.brand-search-wrap
  display: flex
  align-items: center
  flex: 0 0 auto

.site-search-anchored
  display: flex
  align-items: center
  margin-left: 4px

@media (max-width: 991px)
  :host
    display: block
    position: sticky
    top: 0
    z-index: 1030
    background-color: var(--bs-body-bg, #fff)
  .navbar-container
    flex-wrap: wrap
    width: 100%
    max-width: 100%
    padding-inline: var(--space-3)
    gap: var(--space-2)
    overflow-x: hidden
  .brand-search-wrap
    flex: 1 1 0
    min-width: 0
    gap: var(--space-2)
  .navbar-brand
    min-width: 0
    margin-right: 0
  .navbar-brand img
    display: block
    max-width: 100%
    height: auto
  .site-search-anchored, .navbar-toggler
    flex: 0 0 auto
    margin-left: 0
  .navbar-toggler
    display: inline-flex
    align-items: center
    justify-content: center
    min-width: 44px
    min-height: 44px
    padding: var(--space-2)
  .navbar-toggler app-svg
    display: inline-flex
  :host(.mobile-menu-open)
    position: fixed
    inset: 0
    z-index: 2200
    background-color: var(--bs-body-bg, #fff)
    min-height: 100dvh
    overflow-y: auto
    overscroll-behavior: contain
    padding-top: env(safe-area-inset-top, 0px)
    padding-bottom: env(safe-area-inset-bottom, 0px)
  :host(.mobile-menu-open) > div
    min-height: 100%
  :host(.mobile-menu-open) .navbar-collapse
    flex: 1 0 100%
    width: 100%
    max-width: 100%
    min-width: 0
    padding-inline: 0
    max-height: none
    overflow-x: hidden
    overflow-y: visible
  .navbar-toggler:focus:not(:focus-visible)
    box-shadow: none
`],
    imports: [SvgComponent, SiteSearchComponent, NavbarContentComponent, HeaderButtonsComponent, LoginPanelComponent, NgClass, NgStyle, SocialMediaLinksComponent]
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("NavbarComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private host = inject(ElementRef<HTMLElement>);
  private document = inject(DOCUMENT);
  urlService = inject(UrlService);
  public navbarContentWithinCollapse: boolean;
  public logo: Image;
  public navbarExpanded = false;
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];
  private navbarHeightObserver: ResizeObserver | null = null;

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
    this.navbarContentWithinCollapse = width < 992;
    this.publishNavbarHeight();
    this.logger.info("detectWidth:", width, "this.navbarContentWithinCollapse:", this.navbarContentWithinCollapse);
  }

  ngAfterViewInit(): void {
    this.publishNavbarHeight();
    const ResizeObserverType = this.document.defaultView?.ResizeObserver;
    if (ResizeObserverType) {
      this.navbarHeightObserver = new ResizeObserverType(() => this.publishNavbarHeight());
      this.navbarHeightObserver.observe(this.host.nativeElement);
    }
    const logoImage = this.host.nativeElement.querySelector("img");
    if (logoImage) {
      logoImage.addEventListener("load", () => this.publishNavbarHeight());
    }
  }

  publishNavbarHeight(): void {
    const sticky = this.navbarContentWithinCollapse && !this.navbarExpanded;
    const height = sticky ? this.host.nativeElement.getBoundingClientRect().height : 0;
    this.document.documentElement.style.setProperty("--site-navbar-height", `${height}px`);
  }

  toggleNavBar() {
    this.logger.info("navbarExpanded to:", !this.navbarExpanded);
    this.navbarExpanded = !this.navbarExpanded;
    this.publishNavbarHeight();
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
      this.publishNavbarHeight();
    });
    this.detectWidth(window.innerWidth);
  }

  private selectActiveLogo(activeLogo: string) {
    this.logo = this.systemConfig?.logos?.images?.find(logo => logo.originalFileName === activeLogo);
  }

  ngOnDestroy(): void {
    this.navbarHeightObserver?.disconnect();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.document.documentElement.style.removeProperty("--site-navbar-height");
  }

  icon() {
    return this.navbarExpanded ? "i-cross" : "i-menu";
  }

  inlineNavBarVisible(): boolean {
    return !this.navbarContentWithinCollapse && this.systemConfig?.header?.navBar?.location !== NavBarLocation.BELOW_LOGO;
  }

  belowLogoInline(): boolean {
    return !this.navbarContentWithinCollapse && this.systemConfig?.header?.navBar?.location === NavBarLocation.BELOW_LOGO;
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
