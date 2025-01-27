import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgStyle } from "@angular/common";

@Component({
    selector: "app-svg",
    template: `
    <svg [ngStyle]="{'height.px': height, 'width.px': height || width}"
         xmlns="http://www.w3.org/2000/svg">
      <use [attr.xlink:href]="href" [attr.fill]="disabled ? 'rgb(153, 153, 153)' : colour"/>
    </svg>`,
    imports: [NgStyle]
})
export class SvgComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SvgComponent", NgxLoggerLevel.ERROR);
  public disabled: boolean;
  public icon: string;
  public href: string;
  public style: { color: string; width: number; height: number };

  @Input() width: number;
  @Input() height: number;
  @Input() colour: string;

  @Input("icon") set iconValue(icon: string) {
    this.icon = icon;
    this.setHfRef();
  }
  @Input("disabled") set disabledValue(disabled: boolean) {
    this.disabled = disabled;
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
