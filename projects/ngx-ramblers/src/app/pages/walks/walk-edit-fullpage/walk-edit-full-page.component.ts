import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk, EventType, Walk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksService } from "../../../services/walks/walks.service";
import { WalkDisplayService } from "../walk-display.service";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { PageComponent } from "../../../page/page.component";
import { WalkEditComponent } from "../walk-edit/walk-edit.component";

@Component({
    selector: "app-walk-edit-full-page",
    templateUrl: "./walk-edit-full-page.component.html",
    imports: [PageComponent, WalkEditComponent]
})

export class WalkEditFullPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditFullPageComponent", NgxLoggerLevel.ERROR);
  private walksService = inject(WalksService);
  private route = inject(ActivatedRoute);
  private walksReferenceService = inject(WalksReferenceService);
  private dateUtils = inject(DateUtilsService);
  private display = inject(WalkDisplayService);
  public displayedWalk: DisplayedWalk;
  public notifyTarget: AlertTarget = {};
  pageTitle: string;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      if (paramMap.has("add")) {
        this.displayedWalk = {
          walkAccessMode: WalksReferenceService.walkAccessModes.add,
          walk: {
            eventType: RamblersEventType.GROUP_WALK,
            walkType: this.display.walkTypes[0],
            walkDate: this.dateUtils.momentNowNoTime().valueOf(),
            events: []
          },
          status: EventType.AWAITING_LEADER,
          showEndpoint: false
        };
        this.setPageTitle();
      } else {
        const walkId = paramMap.get("walk-id");
        this.logger.debug("querying walk-id", walkId);
        this.walksService.getById(walkId)
          .then((walk: Walk) => {
            this.logger.info("found walk", walk);
            this.displayedWalk = this.display.toDisplayedWalk(walk);
            if (this.displayedWalk.latestEventType) {
              this.setStatus(this.displayedWalk.latestEventType.eventType);
            }
            this.setPageTitle();
          });
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setPageTitle() {
    this.pageTitle = this.displayedWalk.walkAccessMode.title + " walk " + this.walksReferenceService.toWalkEventType(this.status())?.description;
  }

  setStatus(status: EventType) {
    this.logger.debug("setting status =>", status);
    this.displayedWalk.status = status;
  }

  status(): EventType {
    return this.displayedWalk.status;
  }

}
