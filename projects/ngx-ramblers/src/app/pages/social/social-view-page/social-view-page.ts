import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SocialEvent } from "../../../models/social-events.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageService } from "../../../services/page.service";
import { SocialViewComponent } from "../social-view/social-view";

@Component({
    selector: "app-social-view-page",
    template: `
    <app-social-view [socialEvent]="socialEvent"/>
  `,
    imports: [SocialViewComponent]
})
export class SocialViewPageComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public relativePath: string;
  public socialEvent: SocialEvent;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private pageService: PageService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialViewPageComponent, NgxLoggerLevel.OFF);
  }

  @Input("socialEvent") set acceptSocialEventChange(socialEvent: SocialEvent) {
    this.logger.info("Input:socialEvent:", socialEvent);
    this.socialEvent = socialEvent;
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
