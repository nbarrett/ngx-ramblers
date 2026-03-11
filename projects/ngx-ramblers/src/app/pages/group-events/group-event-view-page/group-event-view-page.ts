import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageService } from "../../../services/page.service";
import { GroupEventView } from "../group-event-view/group-event-view";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-group-event-view-page",
    template: `
    <app-group-event-view [groupEvent]="groupEvent"/>
  `,
    imports: [GroupEventView]
})
export class GroupEventViewPage implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventViewPage", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private pageService = inject(PageService);
  public relativePath: string;
  public groupEvent: ExtendedGroupEvent;
  private subscriptions: Subscription[] = [];

  @Input("groupEvent") set acceptGroupEventChange(groupEvent: ExtendedGroupEvent) {
    this.logger.info("Input:groupEvent:", groupEvent);
    this.groupEvent = groupEvent;
  }

  ngOnInit() {
    this.logger.info("groupEvent", this.groupEvent);
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.relativePath = paramMap.get("relativePath");
      this.logger.info("initialised with path:", this.relativePath, "contentPath:", this.pageService.contentPath(this.relativePath));
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
