import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
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
import { Router } from "@angular/router";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-walks-search",
    template: `
    @if (!currentWalkId) {
      @if (showPagination) {
        <div class="row pb-md-2 pb-sm-0 align-items-center g-2">
          <div class="col-12 col-md-3">
            <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
              (ngModelChange)="onSearchChange($event)"
              name="quickSearch"
              class="form-control rounded me-3"
              type="text" placeholder="Quick Search">
          </div>
          <div class="col-12 col-md-3">
            <select [(ngModel)]="filterParameters.selectType"
              (ngModelChange)="refreshWalks('change filterParameters.selectType')" name="selectType"
              class="form-control rounded me-3">
              @for (filter of walksFilter(); track filter.value) {
                <option [ngValue]="filter.value"
                  [selected]="filter.selected">{{ filter.description }}
                </option>
              }
            </select>
          </div>
          <div class="col-12 col-md-3">
            <select [(ngModel)]="filterParameters.ascending"
              (ngModelChange)="refreshWalks('change filterParameters.ascending')" name="ascending"
              class="form-control rounded">
              <option selected [value]="true">Sort (date ascending)</option>
              <option [value]="false">Sort (date descending)</option>
            </select>
          </div>
          <div class="col-12 col-md-3">
            <ng-content select="[view-selector]"/>
          </div>
        </div>
        <div class="d-flex" [class.align-items-center]="showAlertInline()" [class.full-width-pagination]="!showAlertInline()">
          <ng-content/>
          @if (showAlerts && showAlertInline()) {
            <div class="flex-grow-1 d-flex align-items-center">
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
        @if (showAlerts && !showAlertInline()) {
          @if (notifyTarget.showAlert) {
            <div class="alert {{notifyTarget.alertClass}} mt-2 mb-0">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong>{{ notifyTarget.alertTitle }}</strong>
              {{ notifyTarget.alertMessage }}
            </div>
          }
        }
      }
       @if (!showPagination) {
         <div class="d-lg-flex pb-0 align-items-center">
           <div class="form-group me-lg-3 mb-lg-0">
             <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
               (ngModelChange)="onSearchChange($event)"
               name="quickSearch"
               class="form-control rounded me-3"
               type="text" placeholder="Quick Search">
           </div>
           <div class="form-group me-lg-3 mb-lg-0">
             <select [(ngModel)]="filterParameters.selectType"
               (ngModelChange)="refreshWalks('change filterParameters.selectType')" name="selectType"
               class="form-control rounded me-3">
               @for (filter of walksFilter(); track filter.value) {
                 <option [ngValue]="filter.value"
                   [selected]="filter.selected">{{ filter.description }}
                 </option>
               }
             </select>
           </div>
           <div class="form-group me-lg-3 mb-lg-0">
             <select [(ngModel)]="filterParameters.ascending"
               (ngModelChange)="refreshWalks('change filterParameters.ascending')" name="ascending"
               class="form-control rounded">
               <option selected [value]="true">Sort (date ascending)</option>
               <option [value]="false">Sort (date descending)</option>
             </select>
           </div>
           <div class="form-group me-lg-3 mb-lg-0">
             <ng-content select="[view-selector]"/>
           </div>
           <div class="form-group mb-0 flex-grow-1">
             @if (showAlerts && notifyTarget.showAlert) {
               <div class="alert {{notifyTarget.alertClass}}">
                 <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                 <strong>{{ notifyTarget.alertTitle }}</strong>
                 {{ notifyTarget.alertMessage }}
               </div>
             }
           </div>
         </div>
       }
    }`,
    imports: [FormsModule, FontAwesomeModule]
})
export class WalkSearchComponent implements OnInit, OnDestroy {

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
  @Input()
  notifyTarget: AlertTarget;

  @Input()
  filterParameters: FilterParameters;

  @Input()
  showAlerts = true;


  ngOnInit(): void {
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.broadcastService.on(NamedEventType.SHOW_PAGINATION, (show: NamedEvent<boolean>) => {
      this.logger.info("showPagination:", show);
      return this.showPagination = show.data;
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
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  showAlertInline(): boolean {
    const inline = window.innerWidth >= DeviceSize.EXTRA_LARGE;
    this.logger.info("window.innerWidth:", window.innerWidth, "showAlertInline ->", inline);
    return inline;
  }
}
