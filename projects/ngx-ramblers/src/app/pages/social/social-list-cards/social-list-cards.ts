import { Component, Input, OnInit } from "@angular/core";
import { faCopy, faSearch } from "@fortawesome/free-solid-svg-icons";
import min from "lodash-es/min";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { FilterParameters, SocialEvent } from "../../../models/social-events.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { LineFeedsToBreaksPipe } from "../../../pipes/line-feeds-to-breaks.pipe";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ApiResponseProcessor } from "../../../services/api-response-processor.service";
import { CARD_MARGIN_BOTTOM, cardClasses } from "../../../services/card-utils";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-list-cards",
  templateUrl: "./social-list-cards.html",
  styleUrls: ["./social-list-cards.sass"]
})
export class SocialListCardsComponent implements OnInit {
  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;
  private logger: Logger;
  faCopy = faCopy;
  faSearch = faSearch;
  public filterParameters: FilterParameters;

  constructor(public googleMapsService: GoogleMapsService,
              private authService: AuthService,
              private stringUtils: StringUtilsService,
              private searchFilterPipe: SearchFilterPipe,
              private memberService: MemberService,
              private siteEditService: SiteEditService,
              private notifierService: NotifierService,
              private fullNameWithAlias: FullNameWithAliasPipe,
              private lineFeedsToBreaks: LineFeedsToBreaksPipe,
              private socialEventsService: SocialEventsService,
              private memberLoginService: MemberLoginService,
              public display: SocialDisplayService,
              private apiResponseProcessor: ApiResponseProcessor,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              private modalService: BsModalService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialListCardsComponent, NgxLoggerLevel.OFF);
  }

  addSocialEvent() {
    this.urlService.navigateTo(["social", "new"]);
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
