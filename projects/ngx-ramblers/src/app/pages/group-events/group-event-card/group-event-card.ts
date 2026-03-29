import { Component, inject, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { GroupEventDisplayService } from "../group-event-display.service";
import { EventDatesAndTimesPipe } from "../../../pipes/event-times-and-dates.pipe";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { BasicMedia } from "../../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { CardImageOrMap } from "../../../modules/common/card/image/card-image-or-map";
import { WalkDisplayService } from "../../walks/walk-display.service";
import { DisplayedWalk } from "../../../models/walk.model";
import { EventGroupComponent } from "../../walks/walk-view/event-group";

@Component({
    selector: "app-group-event-card",
    template: `
      <div class="card shadow clickable h-100">
        <app-card-image-or-map imageNavigationEnabled [displayedWalk]="displayedWalk" [notify]="notify" [maxColumns]="maxColumns"
                               [navigationHref]="display.groupEventLink(groupEvent, true)"/>
        <div class="card-body">
          <h4 class="card-title">
            <a class="rams-text-decoration-pink"
               [href]="display.groupEventLink(groupEvent, true)"
               target="_self">{{ groupEvent?.groupEvent?.title }}</a>
          </h4>
          <div>{{ groupEvent?.groupEvent | eventDatesAndTimes }}</div>
          <app-event-group [displayedWalk]="displayedWalk" [groupEvent]="groupEvent" compact="true"/>
        </div>
      </div>`,
  providers: [DateUtilsService],
  imports: [EventDatesAndTimesPipe, CardImageOrMap, EventGroupComponent]
})
export class GroupEventCard implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventCard", NgxLoggerLevel.ERROR);
  display = inject(GroupEventDisplayService);
  mediaQueryService = inject(MediaQueryService);
  public walksDisplay = inject(WalkDisplayService);
  public notify: AlertInstance;

  @Input()
  public groupEvent: ExtendedGroupEvent;
  @Input()
  public imagePreview: string;

  faSearch = faSearch;
  protected displayedWalk: DisplayedWalk;
  @Input() maxColumns!: number;

  ngOnInit() {
    this.logger.info("groupEvent:", this.groupEvent);
    this.displayedWalk = this.walksDisplay.toDisplayedWalk(this.groupEvent);
  }

  currentBasicMedia(): BasicMedia {
    return this.mediaQueryService.basicMediaFrom(this.groupEvent?.groupEvent)?.[0];
  }


  imageSourceOrPreview(): string {
    return this.imagePreview || this.currentBasicMedia()?.url;
  }

}
