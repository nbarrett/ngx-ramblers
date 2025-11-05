import { Component, inject, Input } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { min } from "es-toolkit/compat";
import { AlertTarget } from "../../../models/alert-target.model";
import { EventsData } from "../../../models/social-events.model";
import { CARD_MARGIN_BOTTOM, cardClasses } from "../../../services/card-utils";
import { DateUtilsService } from "../../../services/date-utils.service";
import { AlertInstance } from "../../../services/notifier.service";
import { SocialCardComponent } from "../../../pages/social/social-card/social-card";
import { NgClass } from "@angular/common";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { WalkCardViewComponent } from "../../../pages/walks/walk-view/walk-card-view";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";

@Component({
  selector: "app-event-cards-list",
  template: `
    <div class="row">
      @for (extendedGroupEvent of currentPageFilteredEvents; track extendedGroupEvent.groupEvent.url; let index = $index) {
        <div [ngClass]="slideClasses()">
          @if (extendedGroupEvent.groupEvent.item_type === RamblersEventType.GROUP_EVENT) {
            <app-social-card [socialEvent]="extendedGroupEvent" [maxColumns]="eventsData?.maxColumns"/>
          } @else {
            <app-walk-card-view mapClass="map-card-image-events" cardImageClass="card-img-fixed-height" [index]="index"
                                class="card shadow clickable h-100" [maxColumns]="eventsData?.maxColumns"
                                [displayedWalk]="walkDisplayService.toDisplayedWalk(extendedGroupEvent)"/>
          }
        </div>
      }
    </div>`,
  imports: [SocialCardComponent, WalkCardViewComponent, NgClass]
})
export class EventCardsList {

  walkDisplayService = inject(WalkDisplayService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  faSearch = faSearch;

  @Input() public notifyTarget: AlertTarget;
  @Input() public currentPageFilteredEvents: ExtendedGroupEvent[];
  @Input() public eventsData: EventsData;

  protected readonly RamblersEventType = RamblersEventType;

  slideClasses() {
    const eventCount = this.currentPageFilteredEvents.length;
    const minCols = this.eventsData?.minColumns || 1;
    const maxCols = this.eventsData?.maxColumns || 2;
    const columns = Math.max(minCols, Math.min(eventCount, maxCols));
    return cardClasses(columns, CARD_MARGIN_BOTTOM);
  }
}
