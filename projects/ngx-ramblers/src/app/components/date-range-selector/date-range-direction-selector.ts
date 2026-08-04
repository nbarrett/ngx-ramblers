import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { DateTime } from "luxon";
import { DATE_RANGE_DIRECTION_TABS, DateRangeDirection, directionApplicableFor } from "../../models/search.model";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { SectionToggle } from "../../shared/components/section-toggle";

@Component({
  selector: "app-date-range-direction-selector",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SectionToggle],
  template: `
    @if (applicable()) {
      <app-section-toggle [tabs]="directionTabs" [selectedTab]="direction"
                          (selectedTabChange)="onDirectionChange($event)"/>
    }
  `
})
export class DateRangeDirectionSelector {

  @Input() minDate: DateTime;
  @Input() maxDate: DateTime;
  @Input() direction: DateRangeDirection = DateRangeDirection.FUTURE;
  @Output() directionChange = new EventEmitter<DateRangeDirection>();

  protected readonly directionTabs: SectionToggleTab[] = DATE_RANGE_DIRECTION_TABS;

  onDirectionChange(value: DateRangeDirection) {
    if (value !== this.direction) {
      this.direction = value;
      this.directionChange.emit(value);
    }
  }

  applicable(): boolean {
    return directionApplicableFor(this.minDate, this.maxDate);
  }
}
