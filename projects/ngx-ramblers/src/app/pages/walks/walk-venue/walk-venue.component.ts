import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { VenueType } from "../../../models/walk-venue.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-venue",
  templateUrl: "./walk-venue.component.html",
  styleUrls: ["./walk-venue.component.sass"]
})
export class WalkVenueComponent implements OnInit {

  @Input()
  public displayedWalk: DisplayedWalk;
  public venueTypes: VenueType[];
  private logger: Logger;
  public disabledInput: boolean;

  constructor(private memberLoginService: MemberLoginService,
              public display: WalkDisplayService,
              private walksReferenceService: WalksReferenceService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkVenueComponent, NgxLoggerLevel.OFF);
  }

  venueTracker(index: number, venueType: VenueType) {
    return venueType?.type;
  }

  ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.logger.debug("venue is", this.displayedWalk.walk.venue, "venueTypes", this.venueTypes);
    this.disabledInput = !this.allowEdits() && !this.displayedWalk?.walk?.venue?.venuePublish;
  }

  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

}
