import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

let id = 0;

@Component({
  selector: "app-date-picker",
  templateUrl: "./date-picker.component.html",
  styleUrls: ["./date-picker.component.sass"]
})
export class DatePickerComponent implements OnInit, OnChanges {

  dateValue: DateValue;
  @Input() value: DateValue | number;
  @Input() placeholder: string;
  @Input() size: string;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled;
  @Input() prependLabel;
  @Output() dateChange: EventEmitter<DateValue> = new EventEmitter();
  private logger: Logger;
  faCalendar = faCalendar;

  constructor(
    private dateUtils: DateUtilsService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DatePickerComponent", NgxLoggerLevel.OFF);
  }

  ngOnChanges(changes: SimpleChanges) {
    this.logger.debug("changes were", changes);
    this.setValue(changes?.value?.currentValue);
  }

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase(this.label || "date-picker")}-${id++}`;
    }
    this.logger.debug("ngOnInit", typeof this.value, this.value);
    this.setValue(this.value);
  }

  private setValue(value: DateValue | number) {
    if (typeof value === "number") {
      this.dateValue = this.dateUtils.asDateValue(this.value);
    } else {
      this.dateValue = value;
    }
  }

  onModelChange(date: Date) {
    const asDateValue = this.dateUtils.asDateValue(date);
    this.logger.debug("onModelChange asDateValue:", asDateValue);
    this.dateChange.next(asDateValue);
  }
}
