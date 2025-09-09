import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TimepickerComponent } from "ngx-bootstrap/timepicker";
import { NumberUtilsService } from "../services/number-utils.service";
import { isDate } from "lodash-es";

@Component({
  selector: "[app-time-picker]",
  template: `
    @if (label) {
      <label [for]="id">{{ label }}</label>
    }
    <timepicker [showMeridian]=false
                [disabled]="disabled"
                [(ngModel)]="time"
                (ngModelChange)="onModelChange($event)"
                [id]="id">
    </timepicker>
  `,
  imports: [FormsModule, FontAwesomeModule, TimepickerComponent]
})
export class TimePicker {
  private logger: Logger = inject(LoggerFactory).createLogger("TimePicker", NgxLoggerLevel.ERROR);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  protected time: Date;
  @Input() value: string;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled: boolean;

  @Input("value") set valueValue(value: string) {
    this.time = this.dateUtils.asDateTime(value).toJSDate();
  }

  @Output() change: EventEmitter<string> = new EventEmitter();
  public startOfDay: boolean;

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase("date-picker")}-${this.numberUtilsService.generateUid()}`;
    }
    this.logger.info("ngOnInit of :label", this.label, "value type:", typeof this.value, "value:", this.value, "with id:", this.id);
  }

  onModelChange(date: Date) {
    if (isDate(date)) {
      date.setSeconds(0, 0);
      const value: string = date ? this.dateUtils.isoDateTime(date) : null;
      this.logger.info("onModelChange:label", this.label, "date:", date, "of type", typeof date, "emitting value:", value);
      this.change.emit(value);
    } else {
      this.logger.warn("onModelChange:invalid change received:", date, "of type", typeof date);
    }
  }
}
