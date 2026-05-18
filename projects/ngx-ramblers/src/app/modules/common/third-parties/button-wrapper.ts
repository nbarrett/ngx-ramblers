import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { DockedTo } from "../../../models/docking.model";

@Component({
    selector: "app-button-wrapper",
    styles: [`
    .is-disabled
      opacity: 0.65
    .is-disabled-text
      opacity: 0.65
  `],
    template: `
    <div [tooltip]="showTooltip? (disabled ? 'Not available to ' : 'Click to ') + title : null" placement="auto"
         (click)="blockClick($event)"
         [ngClass]="{
           'btn d-inline-flex align-items-center justify-content-center gap-2 px-3 py-2 text-nowrap': button,
           'rounded-start-0': button && dockedTo === DockedTo.RIGHT,
           'rounded-end-0': button && dockedTo === DockedTo.LEFT,
           'not-allowed is-disabled': disabled || loading,
           'pointer': !disabled && !loading
         }"
         [class.btn-primary]="button && variant === 'primary'"
         [class.btn-secondary]="button && variant === 'secondary'"
         [class.btn-quiet]="button && variant === 'quiet'">
      @if (loading) {
        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
      } @else {
        <ng-content/>
      }
      <div [ngClass]="{'is-disabled-text': disabled || loading}">{{ title }}</div>
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
  public variant: string = "primary";
  @Input() dockedTo: DockedTo | null = null;
  protected readonly DockedTo = DockedTo;
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

  @Input("variant") set variantValue(value: string) {
    this.variant = value || "primary";
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
