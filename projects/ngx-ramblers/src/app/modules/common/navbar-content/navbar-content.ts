import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { NgxLoggerLevel } from "ngx-logger";
import { NavBarJustification, NavBarLocation, SystemConfig } from "../../../models/system.model";
import { Subscription } from "rxjs";
import { PageNavigatorComponent } from "../../../page-navigator/page-navigator.component";
import { HeaderButtonsComponent } from "../../../header-buttons/header-buttons";

@Component({
    selector: "app-navbar-content",
    template: `
      <div class="navbar-content-shell"
           #shell
           (pointerdown)="onNavPointerDown($event)"
           (pointermove)="onNavPointerMove($event)"
           (pointerup)="onNavPointerUp($event)"
           (pointercancel)="onNavPointerUp($event)"
           (click)="onNavClick($event)">
        <div [class]="'ramblers-list-' + (systemConfig?.header?.navBar?.class || '') + ' ' + containerClasses()">
          <ul [class]="listClasses()">
            <app-page-navigator/>
          </ul>
        </div>
        <div class="mobile-header-actions bg-dark p-3 mt-3 d-lg-none">
          <div class="d-block d-sm-flex align-items-center justify-content-center gap-3">
            @if (systemConfig?.header?.headerBar?.showNavigationButtons) {
              <app-header-buttons/>
            }
          </div>
        </div>
      </div>
    `,
    styleUrls: ["./navbar-content.sass"],
    imports: [PageNavigatorComponent, HeaderButtonsComponent]
})
export class NavbarContentComponent  implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("NavbarContentComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  urlService = inject(UrlService);
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];
  @ViewChild("shell") private shell: ElementRef<HTMLDivElement> | null = null;
  private navDrag = {active: false, moved: false, startX: 0, startScroll: 0};

  ngOnInit(): void {
    this.logger.info("NavbarContentComponent created");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.logger.info("received:", systemConfig);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onNavPointerDown(event: PointerEvent): void {
    const el = this.shell?.nativeElement;
    if (el && event.button === 0 && event.pointerType !== "touch" && el.scrollWidth > el.clientWidth) {
      this.navDrag = {active: true, moved: false, startX: event.clientX, startScroll: el.scrollLeft};
    }
  }

  onNavPointerMove(event: PointerEvent): void {
    const el = this.shell?.nativeElement;
    if (el && this.navDrag.active) {
      const delta = event.clientX - this.navDrag.startX;
      if (Math.abs(delta) > 4) {
        this.navDrag.moved = true;
        el.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
      el.scrollLeft = this.navDrag.startScroll - delta;
    }
  }

  onNavClick(event: MouseEvent): void {
    if (this.navDrag.moved) {
      event.preventDefault();
      event.stopPropagation();
      this.navDrag.moved = false;
    }
  }

  @HostListener("document:pointerup", ["$event"])
  @HostListener("document:pointercancel", ["$event"])
  onNavPointerUp(event: PointerEvent): void {
    const el = this.shell?.nativeElement;
    if (el && this.navDrag.active) {
      if (this.navDrag.moved) {
        event.preventDefault();
      }
      this.navDrag.active = false;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    }
  }

  containerClasses(): string {
    const location = this.systemConfig?.header?.navBar?.location;
    const justification = this.systemConfig?.header?.navBar?.justification || NavBarJustification.RIGHT;

    if (location === NavBarLocation.BELOW_LOGO) {
      switch (justification) {
        case NavBarJustification.LEFT:
          return "d-flex justify-content-center justify-content-lg-start";
        case NavBarJustification.CENTER:
          return "d-flex justify-content-center";
        case NavBarJustification.RIGHT:
        default:
          return "d-flex justify-content-center justify-content-lg-end";
      }
    } else {
      return "d-flex justify-content-center justify-content-lg-end w-100";
    }
  }

  listClasses(): string {
    const location = this.systemConfig?.header?.navBar?.location;
    const justification = this.systemConfig?.header?.navBar?.justification || NavBarJustification.RIGHT;

    if (location === NavBarLocation.BELOW_LOGO) {
      switch (justification) {
        case NavBarJustification.LEFT:
          return "text-center text-lg-start justify-content-center justify-content-lg-start";
        case NavBarJustification.CENTER:
          return "text-center justify-content-center";
        case NavBarJustification.RIGHT:
        default:
          return "text-center text-lg-end justify-content-center justify-content-lg-end";
      }
    }

    return "text-center text-lg-end";
  }

}
