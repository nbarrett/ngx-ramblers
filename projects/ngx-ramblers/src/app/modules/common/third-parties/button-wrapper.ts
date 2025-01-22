import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-button-wrapper",
  template: `
    <div [tooltip]="showTooltip? (disabled ? 'Not available to ' : 'Click to ') + title : null" placement="auto"
         [ngClass]="{'btn btn-primary px-2 py-2': button, 'not-allowed disabled': disabled, 'pointer': !disabled}">
      <div class="form-inline">
        <ng-content/>
        <div [ngClass]="{'disabled': disabled}" class="ml-2">{{ title }}
        </div>
      </div>
    </div>`,
  standalone: false
})

export class ButtonWrapperComponent implements OnInit {

  private logger: Logger;
  public disabled: boolean;
  public button: boolean;
  public showTooltip: boolean;
  public title: string;

  @Input("title") set titleValue(value: string) {
    this.title = value;
  }


  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("button") set buttonValue(value: boolean) {
    this.button = coerceBooleanProperty(value);
  }

  @Input("showTooltip") set showTooltipValue(value: boolean) {
    this.showTooltip = coerceBooleanProperty(value);
  }

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ButtonWrapperComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled,"showTooltip:", this.showTooltip, "button:", this.button);
  }
}
