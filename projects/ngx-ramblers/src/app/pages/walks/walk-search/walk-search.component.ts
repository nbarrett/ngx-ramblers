import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { DeviceSize } from "../../../models/page.model";
import { FilterParameters } from "../../../models/walk.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walks-search",
  template: `
    <ng-container *ngIf="!currentWalkId">
      <ng-container *ngIf="showPagination">
        <div class="d-flex pb-0">
          <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
                 (ngModelChange)="onSearchChange($event)"
                 name="quickSearch"
                 class="form-control rounded mr-3"
                 type="text" placeholder="Quick Search">
          <select [(ngModel)]="filterParameters.selectType"
                  (ngModelChange)="refreshWalks('change filterParameters.selectType')" name="selectType"
                  class="form-control rounded mr-3">
            <option *ngFor="let filter of walksFilter()" [ngValue]="filter.value"
                    [selected]="filter.selected">{{ filter.description }}
            </option>
          </select>
          <select [(ngModel)]="filterParameters.ascending"
                  (ngModelChange)="refreshWalks('change filterParameters.ascending')" name="ascending"
                  class="form-control rounded">
            <option selected [value]="true">Sort (date ascending)</option>
            <option [value]="false">Sort (date descending)</option>
          </select>
        </div>
        <div class="d-flex mt-3">
          <ng-content></ng-content>
          <div *ngIf="showAlertInline()" class="flex-grow-1">
            <div *ngIf="notifyTarget.showAlert" class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong>{{ notifyTarget.alertTitle }}</strong>
              {{ notifyTarget.alertMessage }}
            </div>
          </div>
        </div>
        <ng-container *ngIf="!showAlertInline()">
          <div *ngIf="notifyTarget.showAlert" class="alert {{notifyTarget.alertClass}}">
            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
            <strong>{{ notifyTarget.alertTitle }}</strong>
            {{ notifyTarget.alertMessage }}
          </div>
        </ng-container>
      </ng-container>
      <ng-container *ngIf="!showPagination">
        <div class="d-lg-flex pb-0">
          <div class="form-group mr-lg-3 mb-lg-0">
            <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
                   (ngModelChange)="onSearchChange($event)"
                   name="quickSearch"
                   class="form-control rounded mr-3"
                   type="text" placeholder="Quick Search">
          </div>
          <div class="form-group mr-lg-3 mb-lg-0">
            <select [(ngModel)]="filterParameters.selectType"
                    (ngModelChange)="refreshWalks('change filterParameters.selectType')" name="selectType"
                    class="form-control rounded mr-3">
              <option *ngFor="let filter of walksFilter()" [ngValue]="filter.value"
                      [selected]="filter.selected">{{ filter.description }}
              </option>
            </select>
          </div>
          <div class="form-group mr-lg-3 mb-lg-0">
            <select [(ngModel)]="filterParameters.ascending"
                    (ngModelChange)="refreshWalks('change filterParameters.ascending')" name="ascending"
                    class="form-control rounded">
              <option selected [value]="true">Sort (date ascending)</option>
              <option [value]="false">Sort (date descending)</option>
            </select>
          </div>
          <div class="form-group mb-0 flex-grow-1">
            <div *ngIf="notifyTarget.showAlert" class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong>{{ notifyTarget.alertTitle }}</strong>
              {{ notifyTarget.alertMessage }}
            </div>
          </div>
        </div>
      </ng-container>
    </ng-container>`
})
export class WalkSearchComponent implements OnInit, OnDestroy {

  @Input()
  notifyTarget: AlertTarget;

  @Input()
  filterParameters: FilterParameters;

  public currentWalkId: string;
  public showPagination = false;
  public group: Organisation;
  private logger: Logger;
  private searchChangeObservable: Subject<string>;
  private subscriptions: Subscription[] = [];

  constructor(private route: ActivatedRoute,
              private walksReferenceService: WalksReferenceService,
              private displayService: WalkDisplayService,
              private memberLoginService: MemberLoginService,
              private broadcastService: BroadcastService<any>,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkSearchComponent", NgxLoggerLevel.OFF);
    this.searchChangeObservable = new Subject<string>();
  }

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
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(1000))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.APPLY_FILTER, searchTerm))));
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
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, selectType));
  }

  showAlertInline(): boolean {
    const showAlertInline: boolean = window.innerWidth >= DeviceSize.SMALL;
    this.logger.info("window.innerWidth:", window.innerWidth, "showAlertInline ->", showAlertInline);
    return showAlertInline;

  }
}
