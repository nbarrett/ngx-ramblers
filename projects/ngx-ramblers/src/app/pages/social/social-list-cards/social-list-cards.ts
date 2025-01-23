import { Component, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import min from "lodash-es/min";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { FilterParameters, SocialEvent } from "../../../models/social-events.model";
import { CARD_MARGIN_BOTTOM, cardClasses } from "../../../services/card-utils";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
import { PageService } from "../../../services/page.service";
import { SocialCardComponent } from "../social-card/social-card";

@Component({
    selector: "app-social-list-cards",
    templateUrl: "./social-list-cards.html",
    styleUrls: ["./social-list-cards.sass"],
    imports: [SocialCardComponent]
})
export class SocialListCardsComponent implements OnInit {
  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;
  private logger: Logger;
  faSearch = faSearch;
  public filterParameters: FilterParameters;

  constructor(public googleMapsService: GoogleMapsService,
              public display: SocialDisplayService,
              private urlService: UrlService,
              private pageService: PageService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialListCardsComponent, NgxLoggerLevel.OFF);
  }

  addSocialEvent() {
    this.urlService.navigateTo([this.pageService.socialPage()?.href, "new"]);
  }

  @Input()
  public notifyTarget: AlertTarget;
  @Input()
  public filteredSocialEvents: SocialEvent[];

  @Input("filterParameters") set acceptChangesFromFilterParameters(filterParameters: FilterParameters) {
    this.filterParameters = filterParameters;
  }

  ngOnInit() {
  }

  slideClasses() {
    return cardClasses(min([this.filteredSocialEvents.length, 2]), CARD_MARGIN_BOTTOM);
  }

}
