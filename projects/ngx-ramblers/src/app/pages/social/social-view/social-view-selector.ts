import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DynamicContentPageComponent } from "../../../modules/common/dynamic-content-page/dynamic-content-page";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { EventViewDispatch, EventViewDispatchWithEvent, ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalkDisplayService } from "../../walks/walk-display.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { StatusIconComponent } from "../../admin/status-icon";
import { Status } from "../../../models/ramblers-upload-audit.model";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { SocialHomeComponent } from "../home/social-home.component";
import { EventDispatchService } from "./event-dispatch-service";
import { SocialViewPageComponent } from "../social-view-page/social-view-page";

@Component({
  selector: "app-social-selector",
    imports: [
    DynamicContentPageComponent,
    StatusIconComponent,
    HumanisePipe,
    SocialHomeComponent,
    SocialViewPageComponent,
  ],
  template: `
    @if (eventView?.eventView === EventViewDispatch.DYNAMIC_CONTENT) {
      <app-dynamic-content-page/>
    } @else if (eventView?.eventView === EventViewDispatch.VIEW) {
      <app-social-view-page [socialEvent]="socialEvent"/>
    } @else if (eventView?.eventView === EventViewDispatch.LIST) {
      <app-social-home/>
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
export class SocialViewSelector implements OnInit {
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

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.eventView = await this.eventDispatchService.eventView(this.notify, "Social Event");
    if (this.eventView.eventView === EventViewDispatch.PENDING) {
      this.logger.info(`${this.eventView.eventView} until event returned`);
      this.socialEvent = await this.eventView.event;
      this.eventView.eventView = this.socialEvent ? EventViewDispatch.VIEW : EventViewDispatch.DYNAMIC_CONTENT;
      this.logger.info(`${this.eventView.eventView} now event returned:`, this.socialEvent);
    }
  }

}
