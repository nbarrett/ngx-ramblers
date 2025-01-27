import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ButtonWrapperComponent } from "./button-wrapper";

@Component({
    selector: "app-meetup-button",
    styles: [`
    .image
      width: 17px
  `],
    template: `
    <app-button-wrapper [disabled]="disabled" [button]="button" [showTooltip]="showTooltip" [title]="title">
      <img title class="image"
           src="/assets/images/local/meetup.ico"
           alt="{{title}}"/>
    </app-button-wrapper>`,
    imports: [ButtonWrapperComponent]
})

export class MeetupButtonComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MeetupButtonComponent", NgxLoggerLevel.ERROR);
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
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled, "showTooltip:", this.showTooltip, "button:", this.button);
  }
}
