import { Component, OnDestroy, OnInit } from "@angular/core";
import range from "lodash-es/range";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { KeyValue } from "../../../functions/enums";
import { IconService } from "../../../services/icon-service/icon-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-icon-examples",
    templateUrl: "./icon-examples.html",
    styleUrls: ["./icon-examples.sass"],
    imports: [FormsModule, TypeaheadDirective, FontAwesomeModule]
})

export class IconExamplesComponent implements OnInit, OnDestroy {

  private logger: Logger;
  public filteredIcons: KeyValue<any>[] = [];
  filter: string;
  sizes = range(1, 6).map(size => `fa-${size}x`);
  size = "fa-3x";
  private searchChangeObservable: Subject<string>;
  private subscriptions: Subscription[] = [];

  constructor(
    public iconService: IconService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(IconExamplesComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.filteredIcons = [];
    this.searchChangeObservable = new Subject<string>();
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(1000))
      .pipe(distinctUntilChanged())
      .subscribe(data => this.refreshFilter(data)));

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  modelChanged(data: string) {
    this.logger.debug("filter changed:", data);
    this.searchChangeObservable.next(data);
  }

  refreshFilter(data: string) {
    if (data) {
      this.logger.debug("refreshFilter with data:", data);
      this.filteredIcons = this.iconService.iconArray.filter(item => item?.key?.toLowerCase().includes(data?.toLowerCase()));
    }
  }

  change($event: Event) {
    this.logger.debug("changed:", $event);
  }
}
