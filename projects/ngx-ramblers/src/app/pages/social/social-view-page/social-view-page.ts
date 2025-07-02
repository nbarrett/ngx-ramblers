import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageService } from "../../../services/page.service";
import { SocialView } from "../social-view/social-view";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-social-view-page",
    template: `
    <app-social-view [socialEvent]="socialEvent"/>
  `,
    imports: [SocialView]
})
export class SocialViewPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialViewPageComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private pageService = inject(PageService);
  public relativePath: string;
  public socialEvent: ExtendedGroupEvent;
  private subscriptions: Subscription[] = [];

  @Input("socialEvent") set acceptSocialEventChange(socialEvent: ExtendedGroupEvent) {
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
