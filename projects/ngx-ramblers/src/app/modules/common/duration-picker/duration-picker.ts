import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

export interface DurationUnitOption {
  value: string;
  label: string;
}

@Component({
  selector: "app-duration-picker",
  imports: [FormsModule],
  template: `
    <div class="row">
      @if (showAmount) {
        <div class="col-sm-6">
          <div class="form-group">
            <label [for]="idPrefix + '-amount'">{{ amountLabel }}</label>
            <input [ngModel]="amount" (ngModelChange)="amountChange.emit($event)"
                   type="number" min="1" [id]="idPrefix + '-amount'" class="form-control input-sm" [disabled]="disabled">
          </div>
        </div>
      }
      <div [class.col-sm-6]="showAmount" [class.col-sm-12]="!showAmount">
        <div class="form-group">
          <label [for]="idPrefix + '-unit'">{{ unitLabel }}</label>
          <select [ngModel]="unit" (ngModelChange)="unitChange.emit($event)"
                  [id]="idPrefix + '-unit'" class="form-control input-sm" [disabled]="disabled">
            @for (option of units; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      </div>
    </div>`
})
export class DurationPickerComponent {
  @Input() amount: number;
  @Input() unit: string;
  @Input() units: DurationUnitOption[] = [];
  @Input() amountLabel = "Amount";
  @Input() unitLabel = "Unit";
  @Input() idPrefix = "duration";
  @Input() noAmountValue: string;
  disabled = false;
  @Output() amountChange = new EventEmitter<number>();
  @Output() unitChange = new EventEmitter<string>();

  @Input({alias: "disabled"}) set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  get showAmount(): boolean {
    return !this.noAmountValue || this.unit !== this.noAmountValue;
  }
}
