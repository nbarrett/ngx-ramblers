import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { DateTime } from "luxon";
import { DATE_RANGE_DIRECTION_TABS, DateRangeDirection, directionApplicableFor } from "../../models/search.model";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { StoredValue } from "../../models/ui-actions";
import { SectionToggle } from "../../shared/components/section-toggle";

@Component({
  selector: "app-date-range-direction-selector",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [SectionToggle],
  template: `
    @if (applicable()) {
      <app-section-toggle [tabs]="directionTabs" [selectedTab]="direction"
                          [queryParamKey]="StoredValue.DATE_RANGE_DIRECTION"
                          (selectedTabChange)="direction = $event"/>
    }
  `
})
export class DateRangeDirectionSelector {

  @Input() minDate: DateTime;
  @Input() maxDate: DateTime;

  protected direction: DateRangeDirection = DateRangeDirection.FUTURE;
  protected readonly directionTabs: SectionToggleTab[] = DATE_RANGE_DIRECTION_TABS;
  protected readonly StoredValue = StoredValue;

  applicable(): boolean {
    return directionApplicableFor(this.minDate, this.maxDate);
  }
}
