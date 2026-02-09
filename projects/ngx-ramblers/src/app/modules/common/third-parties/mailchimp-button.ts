import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ButtonWrapper } from "./button-wrapper";

@Component({
    selector: "app-mailchimp-button",
    styles: [`
    .mailchimp-image
      width: 20px
      border-radius: 25px`],
    template: `
    <app-button-wrapper [disabled]="disabled" [button]="button" [showTooltip]="showTooltip" [title]="title">
      <img title class="mailchimp-image"
           src="/assets/images/local/mailchimp.jpeg"
           alt="{{title}}"/>
    </app-button-wrapper>`,
    imports: [ButtonWrapper]
})

export class MailchimpButton implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpButton", NgxLoggerLevel.ERROR);
  public disabled: boolean;
  public button: boolean;
  public showTooltip: boolean;
  @Input() title: string;

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
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled);
  }
}
