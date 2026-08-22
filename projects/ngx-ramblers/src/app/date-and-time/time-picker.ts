import { Component, ElementRef, EventEmitter, inject, Input, Output } from "@angular/core";
import { kebabCase, isDate } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TimepickerComponent } from "ngx-bootstrap/timepicker";
import { NumberUtilsService } from "../services/number-utils.service";

@Component({
  selector: "[app-time-picker]",
  template: `
    @if (label) {
      <label [for]="id">{{ label }}</label>
    }
    <timepicker [showMeridian]=false
                [disabled]="disabled"
                [minuteStep]="5"
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
  private elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  protected time: Date;
  value: string;
  private ignoreNextChange = false;
  @Input() label: string;
  @Input() id: string;
  @Input() disabled: boolean;

  @Input("value") set valueValue(value: string) {
    this.value = value;
    if (value) {
      const next = this.dateUtils.asDateTime(value).toJSDate();
      if (!this.time || this.time.getTime() !== next.getTime()) {
        this.ignoreNextChange = true;
        this.time = next;
      }
    }
  }

  @Output() timeChange: EventEmitter<string> = new EventEmitter();
  public startOfDay: boolean;

  ngOnInit() {
    if (!this.id) {
      this.id = `${kebabCase("date-picker")}-${this.numberUtilsService.generateUid()}`;
    }
    this.logger.info("ngOnInit of :label", this.label, "value type:", typeof this.value, "value:", this.value, "with id:", this.id);
  }

  onModelChange(date: Date) {
    if (this.ignoreNextChange) {
      this.ignoreNextChange = false;
    } else if (isDate(date) && this.value) {
      this.emitTime(date.getHours(), date.getMinutes());
    } else if (date && !isDate(date)) {
      this.logger.warn("onModelChange:invalid change received:", date, "of type", typeof date);
    }
  }

  commitDisplayedTime(): void {
    if (this.value) {
      const fields = this.elementRef.nativeElement.querySelectorAll(".bs-timepicker-field");
      const hours = parseInt((fields[0] as HTMLInputElement)?.value, 10);
      const minutes = parseInt((fields[1] as HTMLInputElement)?.value, 10);
      if (Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        this.emitTime(hours, minutes);
      }
    }
  }

  private emitTime(hours: number, minutes: number): void {
    const roundedMinutes = Math.round(minutes / 5) * 5;
    const next = this.dateUtils.asDateTime(this.value).set({
      hour: hours,
      minute: roundedMinutes,
      second: 0,
      millisecond: 0
    });
    const value: string = this.dateUtils.isoDateTime(next.toMillis());
    if (value !== this.value) {
      this.logger.info("emitTime:label", this.label, "hours:", hours, "minutes:", roundedMinutes, "emitting value:", value);
      this.timeChange.emit(value);
    }
  }
}
