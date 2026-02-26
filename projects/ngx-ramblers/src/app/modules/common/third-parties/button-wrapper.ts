import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

@Component({
    selector: "app-button-wrapper",
    template: `
    <div [tooltip]="showTooltip? (disabled ? 'Not available to ' : 'Click to ') + title : null" placement="auto"
         (click)="blockClick($event)"
         [ngClass]="{'btn btn-primary d-inline-flex align-items-center justify-content-center gap-2 px-3 py-2 text-nowrap': button, 'not-allowed disabled': disabled || loading, 'pointer': !disabled && !loading}">
      @if (loading) {
        <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
      } @else {
        <ng-content/>
      }
      <div [ngClass]="{'disabled': disabled || loading}">{{ title }}</div>
    </div>`,
    imports: [TooltipDirective, NgClass, FontAwesomeModule]
})

export class ButtonWrapper implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ButtonWrapper", NgxLoggerLevel.ERROR);
  public disabled: boolean;
  public button: boolean;
  public loading: boolean;
  public showTooltip: boolean;
  public title: string;
  protected readonly faSpinner = faSpinner;

  @Input("title") set titleValue(value: string) {
    this.title = value;
  }


  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("button") set buttonValue(value: boolean) {
    this.button = coerceBooleanProperty(value);
  }

  @Input("loading") set loadingValue(value: boolean) {
    this.loading = coerceBooleanProperty(value);
  }

  @Input("showTooltip") set showTooltipValue(value: boolean) {
    this.showTooltip = coerceBooleanProperty(value);
  }

  ngOnInit(): void {
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled,"showTooltip:", this.showTooltip, "button:", this.button);
  }

  blockClick(event: Event) {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
