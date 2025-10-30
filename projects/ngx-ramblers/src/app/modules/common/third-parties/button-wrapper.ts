import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-button-wrapper",
    template: `
    <div [tooltip]="showTooltip? (disabled ? 'Not available to ' : 'Click to ') + title : null" placement="auto"
         [ngClass]="{'btn btn-primary d-inline-flex align-items-center justify-content-center gap-2 px-3 py-2': button, 'not-allowed disabled': disabled, 'pointer': !disabled}">
      <ng-content/>
      <div [ngClass]="{'disabled': disabled}">{{ title }}</div>
    </div>`,
    imports: [TooltipDirective, NgClass]
})

export class ButtonWrapperComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ButtonWrapperComponent", NgxLoggerLevel.ERROR);
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

  ngOnInit(): void {
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled,"showTooltip:", this.showTooltip, "button:", this.button);
  }
}
