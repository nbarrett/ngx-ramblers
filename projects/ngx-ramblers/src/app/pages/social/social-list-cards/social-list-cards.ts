import { Component, inject, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import min from "lodash-es/min";
import { AlertTarget } from "../../../models/alert-target.model";
import { FilterParameters, SocialEvent } from "../../../models/social-events.model";
import { CARD_MARGIN_BOTTOM, cardClasses } from "../../../services/card-utils";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
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

  googleMapsService = inject(GoogleMapsService);
  display = inject(SocialDisplayService);
  private urlService = inject(UrlService);
  private pageService = inject(PageService);
  protected dateUtils = inject(DateUtilsService);

  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;
  faSearch = faSearch;
  public filterParameters: FilterParameters;

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
