import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { GroupEvent } from "../../../models/group-event.model";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";

@Component({
  selector: "[app-group-event-distance-edit]",
  template: `
    <div class="form-inline">
      @if (distanceUnit === 'Km') {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.distance_km"
               (ngModelChange)="onDistanceChange('km', $event)"
               type="number" class="form-control input-sm distance-input" id="distance-km"
               placeholder="Enter Distance in kilometers here">
      }
      @if (distanceUnit === 'Miles') {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.distance_miles"
               (ngModelChange)="onDistanceChange('miles', $event)"
               type="number" class="form-control input-sm distance-input" id="distance-miles"
               placeholder="Enter Distance in miles here">
      }
      <select [(ngModel)]="distanceUnit" (ngModelChange)="onUnitChange($event)"
              class="form-control input-sm">
        <option value="Miles">Miles</option>
        <option value="Km">Km</option>
      </select>
    </div>`,
  styles: [`
    .distance-input
      width: 80px
      margin-right: 12px
  `],
  imports: [FormsModule, FontAwesomeModule]
})
export class GroupEventDistanceEdit implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventDistanceEdit", NgxLoggerLevel.INFO);
  public distanceValidationService = inject(DistanceValidationService);
  @Input() groupEvent: GroupEvent;
  @Input() disabled: boolean;
  @Output() change: EventEmitter<GroupEvent> = new EventEmitter();
  distanceUnit = "Miles";

  async ngOnInit() {
    this.logger.info("groupEvent:", this.groupEvent);
  }

  onUnitChange(unit: "Miles" | "Km") {
    this.distanceUnit = unit;
  }

  onDistanceChange(unit: "miles" | "km", value: number) {
    if (unit === "miles") {
      this.groupEvent.distance_km = this.distanceValidationService.convertMilesToKm(value);
    } else {
      this.groupEvent.distance_miles = this.distanceValidationService.convertKmToMiles(value);
    }
    this.change.emit(this.groupEvent);
  }


}
