import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { BsDatepickerDirective, BsDatepickerInputDirective } from "ngx-bootstrap/datepicker";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import isString from "lodash-es/isString";
import isNumber from "lodash-es/isNumber";

let id = 0;

@Component({
    selector: "app-date-picker",
    template: `<div [ngClass]="{'form-inline': label && prependLabel}">
      @if (label && !prependLabel) {
        <label class="ml-2" [for]="id">{{ label }}</label>
      }
      <div class="input-group">
        @if (label && prependLabel) {
          <div class="input-group-prepend">
            <span class="input-group-text" [attr.aria-expanded]="dp.isOpen">{{ label }}:</span>
          </div>
        }
        <input [ngModel]="dateValue?.date"
               [id]="id"
               (ngModelChange)="onModelChange($event)"
               [disabled]="disabled"
               [placeholder]="placeholder ||'enter date'"
               #dp="bsDatepicker"
               bsDatepicker
               [bsConfig]="{withTimepicker: false, showClearButton: true, clearPosition: 'right', showTodayButton: true, todayPosition: 'center', isAnimated: true, dateInputFormat: 'ddd DD-MMM-YYYY', containerClass: 'theme-ramblers'}"
               type="text" class="form-control" [ngClass]="size ? 'input-' + size: 'input-sm'"/>
        <div class="input-group-append">
      <span class="input-group-text pointer" (click)="disabled? null:dp.toggle()">
        <fa-icon [icon]="faCalendar" class="fa-icon"></fa-icon></span>
        </div>
      </div>
    </div>
    `,
    styleUrls: ["./date-picker.sass"],
    imports: [NgClass, BsDatepickerInputDirective, FormsModule, BsDatepickerDirective, FontAwesomeModule]
})
export class DatePicker implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("DatePicker", NgxLoggerLevel.INFO);
  private dateUtils = inject(DateUtilsService);
  dateValue: DateValue;
  @Input() value: DateValue | number | string;
  @Input() placeholder: string;
  @Input() size: string;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled;
  @Input() prependLabel;

  @Input("startOfDay") set startOfDayValue(startOfDay: boolean) {
    this.startOfDay = coerceBooleanProperty(startOfDay);
  }

  @Output() dateChange: EventEmitter<DateValue> = new EventEmitter();
  public startOfDay = false;
  faCalendar = faCalendar;

  ngOnChanges(changes: SimpleChanges) {
    this.setValue(changes?.value?.currentValue, changes);
  }

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase(this.label || "date-picker")}-${id++}`;
    }
    this.logger.info("ngOnInit of type", typeof this.value, this.value);
    this.setValue(this.value, null);
  }

  private setValue(value: DateValue | number | string, changes: SimpleChanges) {
    const displayDateAndTimeUncorrected = this.dateUtils.displayDateAndTime(this.dateUtils.asMoment(value));
    const usedValue = this.startOfDay ? this.dateUtils.asValueNoTime(value) : value;
    const displayDateAndTimeCorrected = this.dateUtils.displayDateAndTime(usedValue);
    this.logger.info("startOfDay:", this.startOfDay, "changes were:", changes || "ngOnInit", "displayDateAndTimeUncorrected:", displayDateAndTimeUncorrected, "displayDateAndTimeCorrected:", displayDateAndTimeCorrected);
    if (isString(usedValue) || isNumber(usedValue)) {
      this.dateValue = this.dateUtils.asDateValue(usedValue);
    } else {
      this.dateValue = usedValue;
    }
  }

  onModelChange(date: Date) {
    const asDateValue = date ? this.dateUtils.asDateValue(date) : null;
    this.logger.info("onModelChange:date:", date, "asDateValue:", asDateValue);
    this.dateChange.next(asDateValue);
  }
}
