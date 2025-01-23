import { Component, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { SocialEvent } from "../../../models/social-events.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { SocialDisplayService } from "../social-display.service";
import { SocialViewComponent } from "../social-view/social-view";

@Component({
    selector: "app-social-list",
    template: `
    @for (socialEvent of filteredSocialEvents; track socialEvent) {
      <div class="img-thumbnail event-thumbnail">
        <app-social-view [socialEvent]="socialEvent"/>
      </div>
    }
    `,
    styleUrls: ["./social-list.component.sass"],
    imports: [SocialViewComponent]
})
export class SocialListComponent implements OnInit {
  public notify: AlertInstance;
  private logger: Logger;

  constructor(public googleMapsService: GoogleMapsService,
              public display: SocialDisplayService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialListComponent, NgxLoggerLevel.OFF);
  }

  @Input()
  public notifyTarget: AlertTarget;
  @Input()
  public filteredSocialEvents: SocialEvent[];
  faSearch = faSearch;

  ngOnInit() {
    this.logger.info("ngOnInit:filteredSocialEvents:", this.filteredSocialEvents);
  }

  todayValue(): number {
    return this.dateUtils.momentNowNoTime().valueOf();
  }

  socialEventTracker(index: number, socialEvent: SocialEvent) {
    return socialEvent?.id;
  }


}
