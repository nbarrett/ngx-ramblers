import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { DateFilterParameters } from "../../../models/search.model";
import { BASIC_FILTER_OPTIONS, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { EventsData } from "../../../models/social-events.model";
import { ExtendedGroupEvent, HasStartAndEndTime } from "../../../models/group-event.model";
import { UrlService } from "../../../services/url.service";
import { PageService } from "../../../services/page.service";

@Component({
  selector: "app-events-header",
  template: `@if (display.allow.admin) {
    @if (showPagination) {
      <ng-container *ngTemplateOutlet="searchAndFilterActions"/>
      <div class="d-flex">
        @if (!eventsData || eventsData?.allow?.pagination) {
          <pagination class="pagination rounded" [boundaryLinks]=true [rotate]="true" [maxSize]="5"
                      [totalItems]="totalItems" [(ngModel)]="pageNumber"
                      (pageChanged)="pageChanged.emit($event)"/>
        }
        <div class="form-group mb-0 flex-grow-1">
          <ng-container *ngTemplateOutlet="alert"/>
        </div>
      </div>
    }
    @if (!showPagination) {
      <ng-container *ngTemplateOutlet="searchAndFilterActions"/>
    }
  }

  <div class="row">
    <div class="col-sm-10">
      @if (!eventsData || eventsData?.allow?.autoTitle) {
        <h2>{{ display.socialEventsTitle(eventsData?.filterCriteria, fromAndTo()) }}</h2>
      }
    </div>
    @if (display.allow.edits && (!eventsData || eventsData?.allow?.addNew)) {
      <div class="col-lg-2 col-xs-12">
        @if (display.confirm.noneOutstanding()) {
          <input type="submit" [disabled]="notifyTarget.busy"
                 class="btn btn-primary float-lg-right mb-3"
                 value="Add New Event"
                 (click)="addNewEvent()"/>
        }
      </div>
    }
  </div>
  <ng-template #alert>
    @if ((!eventsData || eventsData?.allow?.alert) && notifyTarget.showAlert) {
      <div class="alert {{notifyTarget.alertClass}}">
        <fa-icon [icon]="notifyTarget.alert.icon"/>
        <strong>{{ notifyTarget.alertTitle }}</strong>
        {{ notifyTarget.alertMessage }}
      </div>
    }
  </ng-template>

  <ng-template #searchAndFilterActions>
    <div class="d-lg-flex">
      @if (!eventsData || eventsData?.allow?.quickSearch) {
        <div class="form-group flex-grow-1" [ngClass]="{'mr-lg-3 ':configureFilterCriteria()||configureSortOrder()}">
          <div class="input-group">
            <div class="input-group-prepend rounded" (click)="setFocusTo(input)">
              <span class="input-group-text"><fa-icon [icon]="faSearch"/></span>
            </div>
            <input #input [(ngModel)]="filterParameters.quickSearch"
                   (ngModelChange)="onSearchChange($event)"
                   id="quick-search"
                   class="form-control input-md inline-label rounded"
                   type="text" placeholder="Quick Search">
          </div>
        </div>
      }
      @if (configureFilterCriteria()) {
        <div class="form-group mr-lg-3">
          <select [(ngModel)]="filterParameters.selectType"
                  (ngModelChange)="refreshEvents('change filterParameters.selectType')" name="selectType"
                  class="form-control rounded mr-3">
            @for (dateCriteria of display.filterCriteriaOptionsFor(BASIC_FILTER_OPTIONS); track dateCriteria.value) {
              <option
                [ngValue]="dateCriteria.key">{{ dateCriteria.value }}
              </option>
            }
          </select>
        </div>
      }
      @if (configureSortOrder()) {
        <div class="form-group">
          <select [(ngModel)]="filterParameters.fieldSort"
                  (ngModelChange)="refreshEvents('change filterParameters.fieldSort')" name="sortOrder"
                  class="form-control rounded">
            <option value="-1">Date Descending</option>
            <option selected value="1">Date Ascending</option>
          </select>
        </div>
      }
    </div>
  </ng-template>
  `,
  styles: `
    .inline-label
      padding-left: 20px
      margin-right: 8px
  `,
  imports: [NgTemplateOutlet, FontAwesomeModule, FormsModule, PaginationComponent, NgClass]
})
export class EventsHeader implements OnInit, OnDestroy {

  protected readonly FilterCriteria = FilterCriteria;
  protected readonly BASIC_FILTER_OPTIONS = BASIC_FILTER_OPTIONS;
  private logger: Logger = inject(LoggerFactory).createLogger("SocialSearchComponent", NgxLoggerLevel.ERROR);
  display = inject(SocialDisplayService);
  private urlService: UrlService = inject(UrlService);
  private pageService: PageService = inject(PageService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  faSearch = faSearch;
  private subscriptions: Subscription[] = [];
  public showPagination = false;
  private searchChangeObservable: Subject<string> = new Subject<string>();
  @Output() public pageChanged: EventEmitter<PageChangedEvent> = new EventEmitter();
  @Input() public notifyTarget: AlertTarget;
  @Input() public filterParameters: DateFilterParameters;
  @Input() public eventsData!: EventsData;
  @Input() public currentPageFilteredEvents!: ExtendedGroupEvent[];
  @Input() public pageNumber!: number;
  @Input() totalItems!: number;

  ngOnInit(): void {
    this.broadcastService.on(NamedEventType.SHOW_PAGINATION, (show: NamedEvent<boolean>) => {
      this.logger.info("showPagination:", show);
      return this.showPagination = show.data;
    });
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(1000))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.APPLY_FILTER, searchTerm))));
  }

  fromAndTo(): HasStartAndEndTime {
    return this.display.fromAndToFrom(this.eventsData);
  }

  addNewEvent() {
    this.urlService.navigateTo([this.pageService.socialPage()?.href, "new"]);
  }

  configureFilterCriteria(): boolean {
    return !this.eventsData || this.eventsData?.filterCriteria === FilterCriteria.CHOOSE;
  }

  configureSortOrder(): boolean {
    return !this.eventsData || this.eventsData?.sortOrder === SortOrder.CHOOSE;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);

  }

  refreshEvents(selectType: string) {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, selectType));
  }

  setFocusTo(input: HTMLInputElement) {
    input.focus();
  }
}
