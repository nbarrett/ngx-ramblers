import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialDisplayService } from "../social-display.service";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { DateFilterParameters } from "../../../models/search.model";

@Component({
    selector: "app-social-search",
    templateUrl: "./social-search.html",
    styleUrls: ["./social-search.sass"],
    imports: [NgTemplateOutlet, FontAwesomeModule, FormsModule]
})
export class SocialSearchComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialSearchComponent", NgxLoggerLevel.ERROR);
  display = inject(SocialDisplayService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  faSearch = faSearch;
  private subscriptions: Subscription[] = [];
  public showPagination = false;
  private searchChangeObservable: Subject<string> = new Subject<string>();

  @Input()
  public notifyTarget: AlertTarget;

  @Input()
  filterParameters: DateFilterParameters;

  ngOnInit(): void {
    this.broadcastService.on(NamedEventType.SHOW_PAGINATION, (show: NamedEvent<boolean>) => {
      this.logger.info("showPagination:", show);
      return this.showPagination = show.data;
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

  refreshSocialEvents(selectType: string) {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, selectType));
  }

  setFocusTo(input: HTMLInputElement) {
    input.focus();
  }
}
