import { AfterViewChecked, Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { DeviceSize } from "../../../models/page.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { WalkDisplayService } from "../walk-display.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FilterParameters } from "../../../models/search.model";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-walks-search",
    template: `
    @if (!currentWalkId) {
      <div [class]="showPagination ? 'd-flex pb-md-2 pb-sm-0 align-items-center gap-3 flex-wrap' : 'd-lg-flex pb-0 align-items-center gap-3'">
        {{ logAlertDebug(showPagination ? 'paginated view' : 'non-paginated view') }}
        <div [class]="showPagination ? 'flex-fill' : 'form-group mb-lg-0 flex-fill'">
          <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
            (ngModelChange)="onSearchChange($event)"
            name="quickSearch"
                 class="form-control rounded"
            type="text" placeholder="Quick Search">
        </div>
        <div [class]="showPagination ? 'flex-fill' : 'form-group mb-lg-0 flex-fill'">
          <select [(ngModel)]="filterParameters.selectType"
            (ngModelChange)="refreshWalks('change filterParameters.selectType')" name="selectType"
                  class="form-control rounded">
            @for (filter of walksFilter(); track filter.value) {
              <option [ngValue]="filter.value"
                [selected]="filter.selected">{{ filter.description }}
              </option>
            }
          </select>
        </div>
        <div [class]="showPagination ? 'flex-fill' : 'form-group mb-lg-0 flex-fill'">
          <select [(ngModel)]="filterParameters.ascending"
            (ngModelChange)="refreshWalks('change filterParameters.ascending')" name="ascending"
                  class="form-control rounded">
            <option selected [value]="true">Sort (date ascending)</option>
            <option [value]="false">Sort (date descending)</option>
          </select>
        </div>
        <div [class]="showPagination ? 'flex-shrink-0' : 'form-group mb-lg-0 flex-shrink-0'">
          <ng-content select="[view-selector]"/>
        </div>
        @if (!showPagination && showAlerts && notifyTarget.showAlert) {
          <div class="form-group mb-0 flex-fill">
            <div class="alert {{notifyTarget.alertClass}} mb-0">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong>{{ notifyTarget.alertTitle }}</strong>
              {{ notifyTarget.alertMessage }}
            </div>
          </div>
        }
        @if (showPagination) {
          <ng-content select="[alert-content]"/>
        }
      </div>
      @if (showPagination) {
        <div class="d-flex" [class.align-items-center]="showAlertInline()" [class.full-width-pagination]="!showAlertInline()">
          <ng-content/>
          @if (showAlerts && showAlertInline()) {
            <div class="flex-grow-1 d-flex align-items-center">
              {{ logAlertDebug('inline alert check') }}
              @if (notifyTarget.showAlert) {
                <div class="alert {{notifyTarget.alertClass}} my-0 w-100">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  <strong>{{ notifyTarget.alertTitle }}</strong>
                  {{ notifyTarget.alertMessage }}
                </div>
              }
            </div>
          }
        </div>
      }
    }`,
    imports: [FormsModule, FontAwesomeModule]
})
export class WalkSearchComponent implements OnInit, OnDestroy, AfterViewChecked {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkSearchComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private walksReferenceService = inject(WalksReferenceService);
  private displayService = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  public currentWalkId: string;
  public showPagination = false;
  public group: Organisation;
  private searchChangeObservable: Subject<string> = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private ui = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private shouldFocusSearch = false;
  @ViewChild("quickSearch") quickSearchInput: ElementRef;
  @Input()
  notifyTarget: AlertTarget;
  @Input()
  filterParameters: FilterParameters;
  @Input()
  showAlerts = true;

  logAlertDebug(location: string) {
    this.logger.off(`logAlertDebug walk-search ${location}:`, {
      showAlerts: this.showAlerts,
      showPagination: this.showPagination,
      showAlert: this.notifyTarget.showAlert,
      alertMessage: this.notifyTarget.alertMessage,
      busy: this.notifyTarget.busy
    });
    return "";
  }

  ngOnInit(): void {
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.broadcastService.on(NamedEventType.SHOW_PAGINATION, (show: NamedEvent<boolean>) => {
      this.logger.info("showPagination:", show);
      if (this.showPagination !== show.data) {
        this.showPagination = show.data;
        if (this.filterParameters?.quickSearch) {
          this.shouldFocusSearch = true;
        }
      }
      return this.showPagination;
    });
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, (namedEvent: NamedEvent<SystemConfig>) => {
      this.logger.info("showPagination:", namedEvent.data.group);
      return this.group = namedEvent.data.group;
    });
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => {
        this.ui.saveValueFor(StoredValue.SEARCH, searchTerm || "");
        this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.SEARCH)]: searchTerm || null });
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.APPLY_FILTER, searchTerm));
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusSearch && this.quickSearchInput) {
      this.quickSearchInput.nativeElement.focus();
      this.shouldFocusSearch = false;
    }
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  walksFilter() {
    return this.walksReferenceService.walksFilter
      .filter(item => {
        const condition1 = item.adminOnly ? this.memberLoginService.allowWalkAdminEdits() : true;
        const condition2 = item.localWalkPopulationOnly ? this.displayService.walkPopulationLocal() : true;
        return condition1 && condition2;
      });
  }

  refreshWalks(selectType: string) {
    this.logger.info("filterParameters:", this.filterParameters);
    this.ui.saveValueFor(StoredValue.WALK_SELECT_TYPE, this.filterParameters.selectType);
    this.ui.saveValueFor(StoredValue.WALK_SORT_ASC, this.filterParameters.ascending);
    const typeKebab = this.stringUtils.kebabCase(this.filterParameters.selectType);
    const sortValue = this.filterParameters.ascending ? "true" : "false";
    this.replaceQueryParams({
      [this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE)]: typeKebab,
      [this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC)]: sortValue
    });
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, selectType));
  }

  private replaceQueryParams(params: { [key: string]: any }) {
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
    this.router.navigate([], {relativeTo: this.route, queryParams, queryParamsHandling: "merge"});
  }

  showAlertInline(): boolean {
    const inline = window.innerWidth >= DeviceSize.EXTRA_LARGE;
    this.logger.info("window.innerWidth:", window.innerWidth, "showAlertInline ->", inline);
    return inline;
  }
}
