import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-svg",
  templateUrl: "./svg.html",
  styleUrls: ["./svg.sass"]
})
export class SvgComponent implements OnInit {

  @Input("icon") set iconValue(icon: string) {
    this.icon = icon;
    this.setHfRef();
  }

  public icon: string;
  @Input() width: number;
  @Input() height: number;
  @Input() colour: string;
  @Input() set disabled(disabled: boolean) {
    this.style = {width: this.width, height: this.height, color: disabled ? "rgb(153, 153, 153)" : null};
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
    this.logger.info("setting svg href to:", href);
    this.href = href;
  }
}
