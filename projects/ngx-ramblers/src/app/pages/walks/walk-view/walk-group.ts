import { Component, Input, OnInit } from "@angular/core";
import { faPeopleGroup } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersGroupsApiResponse } from "../../../models/ramblers-walks-manager";
import { DisplayedWalk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
    selector: "app-walk-group",
    templateUrl: "./walk-group.html",
    imports: [RelatedLinkComponent, FontAwesomeModule, TooltipDirective]
})

export class WalkGroupComponent implements OnInit {
  private logger: Logger;
  @Input()
  public displayedWalk: DisplayedWalk;
  faPeopleGroup = faPeopleGroup;
  private groups: RamblersGroupsApiResponse[] = [];

  constructor(
    public googleMapsService: GoogleMapsService,
    private memberLoginService: MemberLoginService,
    public display: WalkDisplayService,
    public ramblersWalksAndEventsService: RamblersWalksAndEventsService,
    private dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkGroupComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.ramblersWalksAndEventsService.groupNotifications().subscribe(item => this.groups = item.response);
  }

  elementNameStart(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Start " : ""}${elementName}`;
  }

  elementNameFinish(elementName: string) {
    return `${this.displayedWalk.showEndpoint ? "Finish " : ""}${elementName}`;
  }

  urlFor(groupCode: string): string {
    const ramblersGroupsApiResponse = this.groups?.find(item => item.group_code === groupCode);
    this.logger.info("given groupCode:", groupCode, "returned:", ramblersGroupsApiResponse);
    return ramblersGroupsApiResponse?.url;
  }
}
