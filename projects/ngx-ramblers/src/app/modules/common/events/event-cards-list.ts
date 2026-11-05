import { Component, inject, Input } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { AlertTarget } from "../../../models/alert-target.model";
import { EventsData } from "../../../models/group-events.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { AlertInstance } from "../../../services/notifier.service";
import { GroupEventCard } from "../../../pages/group-events/group-event-card/group-event-card";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { WalkCardViewComponent } from "../../../pages/walks/walk-view/walk-card-view";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-event-cards-list",
  template: `
    <div class="event-cards" [style.--event-cols]="columnCount()" [class.opacity-50]="notifyTarget?.busy"
         [class.pe-none]="notifyTarget?.busy">
      @for (extendedGroupEvent of currentPageFilteredEvents; track eventKey(extendedGroupEvent); let index = $index) {
        <div class="event-card-slot">
          @if (extendedGroupEvent.groupEvent.item_type === RamblersEventType.GROUP_EVENT) {
            <app-group-event-card [groupEvent]="extendedGroupEvent" [maxColumns]="eventsData?.maxColumns"/>
          } @else {
            <app-walk-card-view mapClass="map-card-image-events" cardImageClass="card-img-fixed-height" [index]="index"
                                class="card shadow clickable h-100" [maxColumns]="eventsData?.maxColumns"
                                navigateOnCardClick
                                [displayedWalk]="walkDisplayService.toDisplayedWalk(extendedGroupEvent)"/>
          }
        </div>
      }
    </div>`,
  styles: [`
    :host
      display: block
      width: 100%
      min-width: 0
    .event-cards
      display: grid
      grid-template-columns: minmax(0, 1fr)
      column-gap: var(--bs-gutter-x, 1.5rem)
    .event-card-slot
      min-width: 0
      margin-bottom: 1.5rem
    @media (min-width: 768px)
      .event-cards
        grid-template-columns: repeat(var(--event-cols, 1), minmax(0, 1fr))
  `],
  imports: [GroupEventCard, WalkCardViewComponent]
})
export class EventCardsList {

  walkDisplayService = inject(WalkDisplayService);
  private stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  faSearch = faSearch;

  @Input() public notifyTarget: AlertTarget;
  @Input() public currentPageFilteredEvents: ExtendedGroupEvent[];
  @Input() public eventsData: EventsData;

  protected readonly RamblersEventType = RamblersEventType;

  columnCount(): number {
    const eventCount = this.currentPageFilteredEvents?.length || 1;
    const minCols = this.eventsData?.minColumns || 1;
    const maxCols = this.eventsData?.maxColumns || 2;
    return Math.max(minCols, Math.min(eventCount, maxCols));
  }

  eventKey(extendedGroupEvent: ExtendedGroupEvent): string {
    const groupEvent = extendedGroupEvent?.groupEvent;
    const baseKey = groupEvent?.id || extendedGroupEvent?.id || groupEvent?.url;
    if (baseKey) {
      return baseKey;
    }
    const dateKey = groupEvent?.start_date_time || "event";
    const titleKey = groupEvent?.title || "unknown";
    const idKey = extendedGroupEvent?.id || groupEvent?.url || "id";
    return this.stringUtils.kebabCase(dateKey, titleKey, idKey);
  }
}
