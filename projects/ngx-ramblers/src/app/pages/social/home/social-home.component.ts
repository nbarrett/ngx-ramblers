import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-social-home",
  template: `
    <app-page>
      <app-social-carousel/>
      <app-social-events/>
    </app-page>
  `,
  styleUrls: ["./social-home.component.sass"]
})
export class SocialHomeComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("SocialHomeComponent", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.logger.info("ngOnInit");
  }

}
