import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { NamedEvent } from "../models/broadcast.model";
import { SiteEditService } from "./site-edit.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { UiSwitchModule } from "ngx-ui-switch";

@Component({
    selector: "app-site-edit",
    templateUrl: "./site-edit.component.html",
    styleUrls: ["./site-edit.component.sass"],
    imports: [UiSwitchModule]
})

export class SiteEditComponent implements OnDestroy {
  private userEdits;
  private logger: Logger;
  private subscriptions: Subscription[] = [];

  constructor(private siteEditService: SiteEditService, private loggerFactory: LoggerFactory) {
    this.userEdits = {preview: true, saveInProgress: false, revertInProgress: false};
    this.subscriptions.push(siteEditService.events.subscribe(item => this.onItemEvent(item)));
    this.logger = loggerFactory.createLogger(SiteEditComponent, NgxLoggerLevel.OFF);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  active() {
    return this.siteEditService.active();
  }

  caption() {
    return this.siteEditService.active() ? "editing site" : "edit site";
  }

  private onItemEvent(event: NamedEvent<boolean>) {
    this.logger.debug("event occurred", event);
  }

  onChange($event: boolean) {
    this.logger.debug("onChange", $event);
    this.siteEditService.toggle($event);
  }

  toggle() {
    this.onChange(!this.active());
  }

}
