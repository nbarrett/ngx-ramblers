import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-svg",
  templateUrl: "./svg.html",
  styleUrls: ["./svg.sass"]
})
export class SvgComponent implements OnInit {
  @Input() icon: string;
  @Input() width: number;
  @Input() colour: string;
  @Input() set disabled(disabled: boolean) {
    this.style = {width: this.width, color: disabled ? "rgb(153, 153, 153)" : null};
  }

  public disabledValue: boolean;
  private logger: Logger;
  href: any;
  public style: { color: string; width: number };

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SvgComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.href = "/assets/images/local/svg-icons.svg#" + this.icon;
    this.logger.info("created with href:", this.href);

  }
}
