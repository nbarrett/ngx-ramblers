import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-svg",
  template: `
    <svg [ngStyle]="{'height.px': height, 'width.px': width}"
         xmlns="http://www.w3.org/2000/svg">
      <use [attr.xlink:href]="href" [attr.fill]="disabled ? 'rgb(153, 153, 153)' : colour"/>
    </svg>`
})
export class SvgComponent implements OnInit {
  @Input("icon") set iconValue(icon: string) {
    this.icon = icon;
    this.setHfRef();
  }
  public disabled: boolean;
  public icon: string;
  @Input() width: number;
  @Input() height: number;
  @Input() colour: string;
  @Input("disabled") set disabledValue(disabled: boolean) {
    this.disabled = disabled;
  }

  private logger: Logger;
  public href: string;
  public style: { color: string; width: number; height: number };

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SvgComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.setHfRef();
  }

  private setHfRef() {
    const href = "/assets/images/local/svg-icons.svg#" + this.icon;
    this.logger.info("setting svg href to:", href,"colour:", this.colour);
    this.href = href;
  }
}
