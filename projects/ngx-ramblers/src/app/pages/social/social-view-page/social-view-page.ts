import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SocialEvent } from "../../../models/social-events.model";
import { Actions } from "../../../models/ui-actions";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-social-view-page",
  templateUrl: "./social-view-page.html",
})
export class SocialViewPageComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public relativePath: string;
  public actions: Actions = new Actions();
  public socialEvent: SocialEvent;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private urlService: UrlService,
    private pageService: PageService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialViewPageComponent, NgxLoggerLevel.OFF);
  }

  @Input("socialEvent") set acceptSocialEventChange(socialEvent: SocialEvent) {
    this.logger.info("Input:socialEvent:", socialEvent);
    this.socialEvent = socialEvent;
  }

  pageTitle(): string {
    return this.socialEvent?.briefDescription || (this.actions.editModeActive() ? "Social Event Edit" : "Social Event Detail");
  }

  ngOnInit() {
    this.logger.info("socialEvent", this.socialEvent);
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.relativePath = paramMap.get("relativePath");
      this.logger.info("initialised with path:", this.relativePath, "contentPath:", this.pageService.contentPath(this.relativePath));
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
