import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import range from "lodash-es/range";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DataQueryOptions, DateCriteria } from "../../../models/api-request.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { FilterParameters, SocialEvent } from "../../../models/social-events.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SocialDisplayService } from "../social-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";

@Component({
  selector: "app-social-events",
  template: `
    <app-social-search [filterParameters]="filterParameters"
                       [notifyTarget]="notifyTarget">
      <pagination pagination class="pagination rounded" [boundaryLinks]=true [rotate]="true" [maxSize]="5"
                  [totalItems]="filteredSocialEvents?.length" [(ngModel)]="pageNumber"
                  (pageChanged)="pageChanged($event)"/>
    </app-social-search>
    <app-social-list-cards [filterParameters]="filterParameters" [notifyTarget]="notifyTarget"
                           [filteredSocialEvents]="currentPageSocials">
    </app-social-list-cards>
  `,
  styleUrls: ["../home/social-home.component.sass"],
  standalone: false
})
export class SocialEventsComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  private logger: Logger;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public socialEventId: string;
  public filterParameters: FilterParameters = {
    fieldSort: 1,
    quickSearch: "",
    selectType: DateCriteria.CURRENT_OR_FUTURE_DATES
  };
  private pageSize = 8;
  public pageNumber = 1;
  public pageCount: number;
  public pages: number[] = [];
  public socialEvents: SocialEvent[] = [];
  public filteredSocialEvents: SocialEvent[] = [];
  public currentPageSocials: SocialEvent[] = this.filteredSocialEvents;
  @Input() rowIndex: number;

  constructor(private systemConfigService: SystemConfigService,
              public pageService: PageService,
              private stringUtils: StringUtilsService,
              private searchFilterPipe: SearchFilterPipe,
              private notifierService: NotifierService,
              public display: SocialDisplayService,
              private broadcastService: BroadcastService<any>,
              private route: ActivatedRoute,
              private socialEventsService: SocialEventsService,
              private memberLoginService: MemberLoginService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SocialEventsComponent", NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.logger.info("ngOnInit started");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.systemConfigService.events().subscribe(item => {
      this.notify.success({
        title: "Social Events",
        message: "Querying for data"
      });
      this.refreshSocialEvents();
    });
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshSocialEvents());
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToSocialEvents(searchTerm));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const socialEventId = paramMap.get("relativePath");
      this.logger.info("socialEventId from route params:", paramMap, socialEventId);
      if (socialEventId) {
        this.socialEventId = socialEventId;
      }
      this.pageService.setTitle("Home");
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public refreshSocialEvents() {
    this.notify.setBusy();
    const dataQueryOptions = {criteria: this.criteria(), sort: this.sort()};
    this.logger.info("refreshSocialEvents:dataQueryOptions", dataQueryOptions);
    this.queryAndReturnSocialEvents(dataQueryOptions)
      .then((socialEvents: SocialEvent[]) => {
        this.logger.info("received socialEvents:", socialEvents);
        this.display.confirm.clear();
        this.socialEvents = socialEvents;
        this.logger.info("received socialEvents:", socialEvents);
        this.applyFilterToSocialEvents();
      })
      .catch(error => {
        this.logger.error("received error:", error);
        this.notify.error({
          title: "Problem viewing Social Events",
          message: error
        });
      });
  }

  private queryAndReturnSocialEvents(dataQueryOptions: DataQueryOptions): Promise<SocialEvent[]> {
    if (this.memberLoginService.memberLoggedIn()) {
      return this.socialEventsService.all(dataQueryOptions);
    } else {
      return this.socialEventsService.allPublic(dataQueryOptions);
    }
  }

  todayValue(): number {
    return this.dateUtils.momentNowNoTime().valueOf();
  }

  criteria() {
    switch (Number(this.filterParameters.selectType)) {
      case DateCriteria.CURRENT_OR_FUTURE_DATES:
        return {eventDate: {$gte: this.todayValue()}};
      case DateCriteria.PAST_DATES:
        return {eventDate: {$lt: this.todayValue()}};
      case DateCriteria.ALL_DATES:
        return {};
    }
  }

  sort() {
    return {eventDate: this.filterParameters.fieldSort};
  }

  applyFilterToSocialEvents(searchTerm?: NamedEvent<string>) {
    this.logger.info("applyFilterToSocialEvents:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.filterParameters.quickSearch);
    this.notify.setBusy();
    this.filteredSocialEvents = this.searchFilterPipe.transform(this.socialEvents, this.filterParameters.quickSearch);
    const filteredCount = (this.filteredSocialEvents?.length) || 0;
    const eventCount = (this.socialEvents?.length) || 0;
    this.notify.progress(`${filteredCount} of ${eventCount} social event${eventCount === 1 ? "" : "s"} shown`);
    this.applyPagination();
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pages.length > 1));
    this.notify.clearBusy();
    this.verifyReady();
  }

  private verifyReady() {
    if (this.display.memberFilterSelections?.length > 0 && this.socialEvents?.length > 0) {
      this.notify.clearBusy();
    }
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.info("event:", event);
    this.goToPage(event.page);
  }

  previousPage() {
    if (this.pageNumber > 1) {
      this.goToPage(this.pageNumber - 1);
    }
  }

  nextPage() {
    if (this.pageNumber < this.pages.length) {
      this.goToPage(this.pageNumber + 1);
    }
  }

  goToPage(pageNumber) {
    this.pageNumber = pageNumber;
    this.applyPagination();
  }

  paginate(walks: SocialEvent[], pageSize, pageNumber): SocialEvent[] {
    return walks.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  }

  private applyPagination() {
    this.pageCount = Math.ceil(this.filteredSocialEvents.length / this.pageSize);
    this.currentPageSocials = this.paginate(this.filteredSocialEvents, this.pageSize, this.pageNumber);
    this.pages = range(1, this.pageCount + 1);
    const filteredImageCount = this.filteredSocialEvents.length;
    this.logger.info("applyPagination: filtered social event count", filteredImageCount, "filtered social event count", filteredImageCount, "current page social count", this.currentPageSocials.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages, "currentPageSocials:", this.currentPageSocials.map(item => item.id));
    if (this.currentPageSocials.length === 0) {
      this.notify.progress("No social events found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const pageIndicator = this.pageCount > 1 ? `Page ${this.pageNumber} of ${this.pageCount}` : `Page ${this.pageNumber}`;
      this.notify.progress(`${pageIndicator} — showing ${offset} to ${offset + this.pageSize - 1} of ${this.stringUtils.pluraliseWithCount(filteredImageCount, "social event")}`);
    }
  }
}
