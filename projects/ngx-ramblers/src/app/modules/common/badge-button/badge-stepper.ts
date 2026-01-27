import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass, NgStyle } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-badge-stepper",
  styleUrls: ["./badge-stepper.sass"],
  template: `
    <div [ngClass]="{'badge-stepper': true, 'me-0': noRightMargin}"
         delay=500 [tooltip]="tooltip" [ngStyle]="{'height.px': height}">
      <button type="button" class="stepper-btn stepper-minus"
              [disabled]="!canDecrease"
              (click)="decrease()">
        <fa-icon [icon]="faMinus"></fa-icon>
      </button>
      @if (icon) {
        <fa-icon class="stepper-icon" [icon]="icon"></fa-icon>
      }
      <span class="stepper-value">{{ formattedValue() }}</span>
      <button type="button" class="stepper-btn stepper-plus"
              [disabled]="!canIncrease"
              (click)="increase()">
        <fa-icon [icon]="faPlus"></fa-icon>
      </button>
    </div>`,
  imports: [NgClass, TooltipDirective, NgStyle, FontAwesomeModule]
})

export class BadgeStepperComponent {
  private stringUtils: StringUtilsService = inject(StringUtilsService);

  @Input() public tooltip: string;
  @Input() public height: number;
  @Input() public value: number = 0;
  @Input() public min: number = 0;
  @Input() public max: number = 10;
  @Input() public step: number = 1;
  @Input() public unit: string;
  @Input() public icon: IconDefinition;
  @Input() public labels: Record<number, string>;

  @Output() valueChange = new EventEmitter<number>();

  @Input("noRightMargin") set noRightMarginValue(value: boolean) {
    this.noRightMargin = coerceBooleanProperty(value);
  }

  public noRightMargin: boolean;

  protected readonly faMinus = faMinus;
  protected readonly faPlus = faPlus;

  get canIncrease(): boolean {
    return this.value < this.max;
  }

  get canDecrease(): boolean {
    return this.value > this.min;
  }

  increase() {
    if (this.canIncrease) {
      this.value = this.roundToStep(this.value + this.step);
      this.valueChange.emit(this.value);
    }
  }

  decrease() {
    if (this.canDecrease) {
      this.value = this.roundToStep(this.value - this.step);
      this.valueChange.emit(this.value);
    }
  }

  private roundToStep(value: number): number {
    const precision = this.decimalPlaces(this.step);
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  private decimalPlaces(num: number): number {
    const str = num.toString();
    const decimalIndex = str.indexOf(".");
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
  }

  formattedValue(): string {
    if (this.labels && this.labels[this.value] !== undefined) {
      return this.labels[this.value];
    }
    const displayValue = this.formatNumber(this.value);
    if (!this.unit) {
      return displayValue;
    }
    if (this.shouldPluralise()) {
      return this.stringUtils.pluraliseWithCount(this.value, this.unit);
    }
    return `${displayValue} ${this.unit}`;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  }

  private shouldPluralise(): boolean {
    const nonPluralUnits = ["rem", "px", "em", "%", "gap"];
    return !nonPluralUnits.includes(this.unit?.toLowerCase() || "");
  }

}
