import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GroupEvent } from "../../../models/group-event.model";
import { DistanceUnit } from "../../../models/walk.model";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";

@Component({
  selector: "[app-event-ascent-edit]",
  template: `
    <div class="input-group input-group-sm">
      @if (ascentUnit === DistanceUnit.FEET) {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.ascent_feet"
               (ngModelChange)="onAscentChange(DistanceUnit.FEET, $event)"
               type="number" class="form-control input-sm" [id]="id"
               placeholder="Ascent">
      } @else {
        <input [disabled]="disabled" [(ngModel)]="groupEvent.ascent_metres"
               (ngModelChange)="onAscentChange(DistanceUnit.METRES, $event)"
               type="number" class="form-control input-sm" [id]="id"
               placeholder="Ascent">
      }
      <select [disabled]="disabled" [(ngModel)]="ascentUnit" (ngModelChange)="onUnitChange($event)"
              class="form-control input-sm ascent-unit">
        <option [value]="DistanceUnit.FEET">{{ DistanceUnit.FEET }}</option>
        <option [value]="DistanceUnit.METRES">{{ DistanceUnit.METRES }}</option>
      </select>
    </div>
  `,
  styles: [`
    .ascent-unit
      max-width: 4.5rem
      flex: 0 0 4.5rem
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
