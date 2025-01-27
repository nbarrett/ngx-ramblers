import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { VenueType } from "../../../models/walk-venue.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";

@Component({
    selector: "app-walk-venue",
    templateUrl: "./walk-venue.component.html",
    styleUrls: ["./walk-venue.component.sass"],
    imports: [MarkdownEditorComponent, FormsModule, FontAwesomeModule, TooltipDirective, VenueIconPipe]
})
export class WalkVenueComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkVenueComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  display = inject(WalkDisplayService);
  private walksReferenceService = inject(WalksReferenceService);

  @Input()
  public displayedWalk: DisplayedWalk;
  public venueTypes: VenueType[];
  public disabledInput: boolean;

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
