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

let id = 0;

@Component({
    selector: "app-date-picker",
    templateUrl: "./date-picker.component.html",
    styleUrls: ["./date-picker.component.sass"],
    imports: [NgClass, BsDatepickerInputDirective, FormsModule, BsDatepickerDirective, FontAwesomeModule]
})
export class DatePickerComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("DatePickerComponent", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);

  dateValue: DateValue;
  @Input() value: DateValue | number;
  @Input() placeholder: string;
  @Input() size: string;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled;
  @Input() prependLabel;

  @Input("startOfDay") set previewValue(startOfDay: boolean) {
    this.startOfDay = coerceBooleanProperty(startOfDay);
  }

  @Output() dateChange: EventEmitter<DateValue> = new EventEmitter();
  public startOfDay: boolean;
  faCalendar = faCalendar;

  ngOnChanges(changes: SimpleChanges) {
    this.setValue(changes?.value?.currentValue, changes);
  }

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase(this.label || "date-picker")}-${id++}`;
    }
    this.logger.info("ngOnInit", typeof this.value, this.value);
    this.setValue(this.value, null);
  }

  private setValue(value: DateValue | number, changes: SimpleChanges) {
    const displayDateAndTimeUncorrected = this.dateUtils.displayDateAndTime(this.dateUtils.asMoment(value));
    const usedValue = this.startOfDay ? this.dateUtils.asValueNoTime(value) : value;
    const displayDateAndTimeCorrected = this.dateUtils.displayDateAndTime(usedValue);
    this.logger.info("startOfDay:", this.startOfDay, "changes were:", changes || "ngOnInit", "displayDateAndTimeUncorrected:", displayDateAndTimeUncorrected, "displayDateAndTimeCorrected:", displayDateAndTimeCorrected);
    if (typeof usedValue === "number") {
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
