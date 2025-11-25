import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import { kebabCase, isString, isNumber } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { BsDatepickerDirective, BsDatepickerInputDirective } from "ngx-bootstrap/datepicker";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NumberUtilsService } from "../services/number-utils.service";
import { BsDatepickerFormat, UIDateFormat } from "../models/date-format.model";

type SupportedInputTypes = DateValue | number | string;

@Component({
    selector: "app-date-picker",
  template: `
    <div [class]="(label && prependLabel) ? 'd-flex align-items-center flex-wrap' : ''">
      @if (label && !prependLabel) {
        <label [for]="id">{{ label }}</label>
      }
      <div class="input-group">
        @if (label && prependLabel) {
          <span class="input-group-text" [attr.aria-expanded]="dp.isOpen">{{ label }}:</span>
        }
        <input [ngModel]="dateValue?.date"
               [id]="id"
               (ngModelChange)="onModelChange($event)"
               [disabled]="disabled"
               [readonly]="readonly"
               [placeholder]="placeholder ||'enter date'"
               #dp="bsDatepicker"
               bsDatepicker
               [bsConfig]="{withTimepicker: false, showClearButton: true, clearPosition: 'right', showTodayButton: true, todayPosition: 'center', isAnimated: true, dateInputFormat: BsDatepickerFormat.DATE_INPUT, containerClass: 'theme-ramblers'}"
               type="text" [class]="'form-control ' + (size ? 'input-' + size: 'input-sm')"/>
        <button type="button" class="btn btn-outline-secondary" (click)="disabled? null:dp.toggle()">
          <fa-icon [icon]="faCalendar" class="fa-icon"/>
        </button>
      </div>
    </div>
    `,
    styleUrls: ["./date-picker.sass"],
    imports: [BsDatepickerInputDirective, FormsModule, BsDatepickerDirective, FontAwesomeModule]
})
export class DatePicker implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DatePicker", NgxLoggerLevel.ERROR);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  dateValue: DateValue;
  lastEmittedValue: DateValue;
  @Input() value: SupportedInputTypes;
  @Input() placeholder: string;
  @Input() size: string;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled;
  @Input() readonly;
  @Input() prependLabel;

  @Input("value") set valueValue(value: SupportedInputTypes) {
    this.setValue(value);
  }

  @Input("startOfDay") set startOfDayValue(startOfDay: boolean) {
    this.startOfDay = coerceBooleanProperty(startOfDay);
  }

  @Output() change: EventEmitter<DateValue> = new EventEmitter();
  public startOfDay = false;
  faCalendar = faCalendar;
  protected readonly UIDateFormat = UIDateFormat;
  protected readonly BsDatepickerFormat = BsDatepickerFormat;

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase(this.label || "date-picker")}-${this.numberUtilsService.generateUid()}`;
    }
    if (this.value) {
      this.setValue(this.value);
    }
    this.logger.info("ngOnInit of value: ", this.value, "of type:", typeof this.value, "dateValue:", this.dateValue, "with id:", this.id);
  }

  private setValue(value: SupportedInputTypes) {
    if (value instanceof Event) {
      this.logger.warn("setValue:unexpected Event received:", value);
    } else if (!value && value !== 0) {
      this.dateValue = null;
      this.logger.info("setValue:clearing dateValue due to empty value:", value);
    } else {
      const usedValue = this.startOfDay ? this.dateUtils.asValueNoTime(value) : value;
      if (isString(usedValue) || isNumber(usedValue)) {
        this.dateValue = this.dateUtils.asDateValue(usedValue);
      } else {
        this.dateValue = usedValue;
      }
      this.logger.info("setValue:startOfDay:", this.startOfDay, "value:", value, "usedValue:", usedValue, "of type:", typeof usedValue, "dateValue:", this.dateValue);
    }
  }

  dateValueFrom(date: Date): DateValue {
    const midnight = this.dateUtils.isMidnight(date);
    if (!date) {
      this.logger.info("dateValueFrom: date:", date, "retuning null");
      return null;
    } else if (midnight && this.lastEmittedValue && !this.startOfDay) {
      const baseDateTime = this.dateUtils.asDateTime(date);
      const withTime = baseDateTime.set({
        hour: this.lastEmittedValue.date.getHours(),
        minute: this.lastEmittedValue.date.getMinutes()
      });
      const dateValue: DateValue = this.dateUtils.asDateValue(withTime.toMillis());
      this.logger.info("dateValueFrom: date is at midnight:", date, "dateValue:", dateValue);
      return dateValue;
    } else {
      const dateValue: DateValue = this.dateUtils.asDateValue(date);
      this.logger.info("dateValueFrom: date has time supplied:", date, "dateValue:", dateValue);
      return dateValue;
    }
  }

  onModelChange(date: Date) {
    const dateValue = this.dateValueFrom(date);
    this.logger.info("onModelChange:date:", date, "dateValue:", dateValue);
    this.change.next(dateValue);
    this.lastEmittedValue = dateValue;
  }
}
