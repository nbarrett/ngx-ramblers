import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { GroupEvent } from "../../../models/group-event.model";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DistanceUnit } from "../../../models/walk.model";
import kebabCase from "lodash-es/kebabCase";
import { NumberUtilsService } from "../../../services/number-utils.service";

@Component({
  selector: "[app-event-distance-edit]",
  template: `
    @if (label) {
      <label for="distance-km-{{id}}">{{ label }}</label>
    }
    <div class="d-flex align-items-baseline flex-wrap">
      @if (distanceUnit === DistanceUnit.KILOMETRES) {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.distance_km"
               (ngModelChange)="onDistanceChange(DistanceUnit.KILOMETRES, $event)"
               type="number" step="0.25" class="form-control input-sm distance-input" id="distance-km-{{id}}"
               placeholder="Enter Distance in kilometers here">
      } @else {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.distance_miles"
               (ngModelChange)="onDistanceChange(DistanceUnit.MILES, $event)"
               type="number" step="0.25" class="form-control input-sm distance-input" id="distance-miles-{{id}}"
               placeholder="Enter Distance in miles here">
      }
      <select [(ngModel)]="distanceUnit" (ngModelChange)="onUnitChange($event)"
              class="form-control input-sm">
        <option [value]="DistanceUnit.MILES">{{ DistanceUnit.MILES }}</option>
        <option [value]="DistanceUnit.KILOMETRES">{{ DistanceUnit.KILOMETRES }}</option>
      </select>
    </div>`,
  styles: [`
    .distance-input
      width: 77px
      margin-right: 12px
    select.form-control
      width: 80px
      margin-left: 4px
  `],
  imports: [FormsModule, FontAwesomeModule]
})
export class EventDistanceEdit implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("EventDistanceEdit", NgxLoggerLevel.ERROR);
  public distanceValidationService = inject(DistanceValidationService);
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  @Input() label: string;
  @Input() groupEvent: GroupEvent;
  @Input() id: string;
  @Input() disabled: boolean;
  @Output() change: EventEmitter<GroupEvent> = new EventEmitter();
  distanceUnit = DistanceUnit.MILES;


  protected readonly DistanceUnit = DistanceUnit;

  async ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase("date-picker")}-${this.numberUtilsService.generateUid()}`;
    }
    this.logger.info("ngOnInit of groupEvent:", this.groupEvent, "with id:", this.id);
  }

  onUnitChange(unit: DistanceUnit) {
    this.distanceUnit = unit;
  }

  onDistanceChange(unit: DistanceUnit, value: number) {
    if (unit === DistanceUnit.MILES) {
      this.groupEvent.distance_km = this.distanceValidationService.convertMilesToKm(value);
    } else {
      this.groupEvent.distance_miles = this.distanceValidationService.convertKmToMiles(value);
    }
    this.change.emit(this.groupEvent);
  }
}
