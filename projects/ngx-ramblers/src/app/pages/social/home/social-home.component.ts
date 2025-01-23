import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageComponent } from "../../../page/page.component";
import { SocialCarouselComponent } from "../social-carousel/social-carousel";
import { SocialEventsComponent } from "../list/social-events";

@Component({
    selector: "app-social-home",
    template: `
    <app-page>
      <app-social-carousel/>
      <app-social-events/>
    </app-page>
  `,
    styleUrls: ["./social-home.component.sass"],
    imports: [PageComponent, SocialCarouselComponent, SocialEventsComponent]
})
export class SocialHomeComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("SocialHomeComponent", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.logger.info("ngOnInit");
  }

}
