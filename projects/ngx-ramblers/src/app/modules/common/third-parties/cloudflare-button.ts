import { Component, HostListener, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ButtonWrapper } from "./button-wrapper";

@Component({
    selector: "app-cloudflare-button",
    styles: [`
    .image
      width: 20px
  `],
    template: `
    <app-button-wrapper [disabled]="disabled" [loading]="loading" [button]="button" [showTooltip]="showTooltip" [title]="title">
      <img title class="image"
           src="/assets/icons/cloudflare-logo.svg"
           alt="{{title}}"/>
    </app-button-wrapper>`,
    imports: [ButtonWrapper]
})

export class CloudflareButton implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("CloudflareButton", NgxLoggerLevel.ERROR);
  public disabled: boolean;
  public button: boolean;
  public loading: boolean;
  public showTooltip: boolean;
  public title: string;

  @Input("title") set titleValue(value: string) {
    this.title = value;
  }

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("loading") set loadingValue(value: boolean) {
    this.loading = coerceBooleanProperty(value);
  }

  @Input("button") set buttonValue(value: boolean) {
    this.button = coerceBooleanProperty(value);
  }

  @Input("showTooltip") set showTooltipValue(value: boolean) {
    this.showTooltip = coerceBooleanProperty(value);
  }

  @HostListener("click", ["$event"]) handleClick(event: Event) {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  ngOnInit(): void {
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled, "showTooltip:", this.showTooltip, "button:", this.button);
  }
}
