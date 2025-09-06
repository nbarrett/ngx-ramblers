import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GroupEvent } from "../../../models/group-event.model";
import { DistanceUnit } from "../../../models/walk.model";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";

@Component({
  selector: "[app-event-ascent-edit]",
  template: `
    <div class="d-inline-flex align-items-center flex-wrap">
      @if (ascentUnit === DistanceUnit.FEET) {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.ascent_feet"
               (ngModelChange)="onAscentChange(DistanceUnit.FEET, $event)"
               type="number" class="form-control input-sm ascent-input" [id]="id"
               placeholder="Enter Ascent">
      } @else {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.ascent_metres"
               (ngModelChange)="onAscentChange(DistanceUnit.METRES, $event)"
               type="number" class="form-control input-sm ascent-input" [id]="id"
               placeholder="Enter Ascent">
      }
      <select [(ngModel)]="ascentUnit" (ngModelChange)="onUnitChange($event)"
              class="form-control input-sm">
        <option [value]="DistanceUnit.FEET">{{ DistanceUnit.FEET }}</option>
        <option [value]="DistanceUnit.METRES">{{ DistanceUnit.METRES }}</option>
      </select>
    </div>
  `,
  styles: [`
    .ascent-input
      width: 120px
      margin-right: 12px
  `],
  imports: [
    FormsModule
  ]
})
export class EventAscentEdit {
  @Input() groupEvent: GroupEvent;
  @Input() disabled = false;
  @Input() id: string;
  @Output() change = new EventEmitter<{ unit: string; value: number }>();
  ascentUnit = DistanceUnit.FEET;
  private ascentValidationService: AscentValidationService = inject(AscentValidationService);
  protected readonly DistanceUnit = DistanceUnit;

  onAscentChange(unit: DistanceUnit, value: number): void {
    if (unit === DistanceUnit.METRES) {
      this.groupEvent.ascent_feet = this.ascentValidationService.convertMetresToFeet(value);
    } else if (unit === DistanceUnit.FEET) {
      this.groupEvent.ascent_metres = this.ascentValidationService.convertFeetToMetres(value);
    }
    this.change.emit({unit, value});
  }

  onUnitChange(unit: DistanceUnit) {
    this.ascentUnit = unit;
  }
}
