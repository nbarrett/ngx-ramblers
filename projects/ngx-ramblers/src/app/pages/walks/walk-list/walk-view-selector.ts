import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DynamicContentPageComponent } from "../../../modules/common/dynamic-content-page/dynamic-content-page";
import { WalkViewComponent } from "../walk-view/walk-view";
import { WalkList } from "./walk-list";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { EventViewDispatch, EventViewDispatchWithEvent, ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalkDisplayService } from "../walk-display.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { StatusIconComponent } from "../../admin/status-icon";
import { Status } from "../../../models/ramblers-upload-audit.model";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { EventDispatchService } from "../../social/social-view/event-dispatch-service";
import { DisplayedWalk } from "../../../models/walk.model";
import { NavigationEnd, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-walks-selector",
    imports: [
    DynamicContentPageComponent,
    WalkViewComponent,
    WalkList,
    StatusIconComponent,
    HumanisePipe,
  ],
  template: `
    @if (eventView?.eventView === EventViewDispatch.DYNAMIC_CONTENT) {
      <app-dynamic-content-page/>
    } @else if (eventView?.eventView === EventViewDispatch.VIEW) {
      <app-walk-view [displayedWalk]="displayedWalk"/>
    } @else if (eventView?.eventView === EventViewDispatch.LIST) {
      <app-walk-list/>
    } @else if (eventView?.eventView === EventViewDispatch.PENDING) {
      <div class="event-thumbnail card shadow tabset-container">
        <div class="row">
          <div class="col-sm-12 rounded align-items-center">
            <div class="d-inline-flex align-items-center flex-wrap">
              <h1 id="pending-title">Finding {{ this.urlService.lastPathSegment() | humanise }}</h1>
              <app-status-icon class="ms-3" noLabel [status]="Status.ACTIVE"/>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class WalksViewSelector implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("SocialViewSelector", NgxLoggerLevel.ERROR);
  private eventDispatchService: EventDispatchService = inject(EventDispatchService);
  protected urlService: UrlService = inject(UrlService);
  protected eventView: EventViewDispatchWithEvent = null;
  public display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  protected socialEvent: ExtendedGroupEvent;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private notifierService = inject(NotifierService);
  protected readonly EventViewDispatch = EventViewDispatch;
  protected readonly Status = Status;
  protected displayedWalk: DisplayedWalk;
  private router = inject(Router);
  private navigationSubscription?: Subscription;

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    await this.loadEventView();
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        void this.loadEventView();
      });
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();
  }

  private async loadEventView(): Promise<void> {
    this.eventView = await this.eventDispatchService.eventView(this.notify, "Walk");
    if (this.eventView.eventView === EventViewDispatch.PENDING) {
      this.logger.info(`${this.eventView.eventView} until event returned`);
      const event = await this.eventView.event;
      this.displayedWalk = this.display.toDisplayedWalk(event);
      this.eventView.eventView = event ? EventViewDispatch.VIEW : EventViewDispatch.DYNAMIC_CONTENT;
      this.logger.info(`${this.eventView.eventView} now event returned:`, this.socialEvent);
    }
  }
}
