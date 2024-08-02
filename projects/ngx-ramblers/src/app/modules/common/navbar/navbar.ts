import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  classBackgroundDark,
  classColourCloudy,
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

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.html",
  styleUrls: ["./navbar.sass"]
})
export class NavbarComponent implements OnInit, OnDestroy {

  constructor(
    private systemConfigService: SystemConfigService,
    private broadcastService: BroadcastService<any>,
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("NavbarComponent", NgxLoggerLevel.ERROR);
  }

  private logger: Logger;
  public navbarContentWithinCollapse: boolean;
  public logo: Image;
  public navbarExpanded = false;
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];

  protected readonly NavBarLocation = NavBarLocation;
  protected readonly classColourCloudy = classColourCloudy;
  protected readonly colourCloudy = rgbColourCloudy;

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

  protected readonly colourGranite = rgbColourGranite;
  protected readonly classBackgroundDark = classBackgroundDark;
}
