import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { VenueType } from "../../../models/event-venue.model";
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
    template: `
      <div class="row img-thumbnail thumbnail-2">
        <div class="thumbnail-heading">Venue</div>
        <div class="col-sm-12">
          <app-markdown-editor name="meetup-venue-help" description="Walk venue or pub"></app-markdown-editor>
        </div>
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-4">
              <div class="form-group">
                <label for="type">Type</label>
                @if (venueTypes) {
                  <select [disabled]="disabledInput" class="form-control input-sm"
                          [(ngModel)]="displayedWalk.walk.fields.venue.type"
                          id="type">
                    @for (type of venueTypes; track venueTracker($index, type)) {
                      <option
                        [ngValue]="type.type"
                        [textContent]="type.type">
                      </option>
                    }
                  </select>
                }
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="name">Name</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.name"
                       type="text" class="form-control input-sm"
                       id="name"
                       placeholder="Enter name of venue or pub">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="address1">Address 1</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address1"
                       type="text" class="form-control input-sm"
                       id="address1"
                       placeholder="Enter first line of the address">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="address2">Address 2</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.address2"
                       type="text" class="form-control input-sm"
                       id="address2"
                       placeholder="Enter second line of the address">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="postcode">Postcode</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.postcode"
                       type="text" class="form-control input-sm"
                       id="postcode"
                       placeholder="Enter postcode">
              </div>
            </div>
            <div class="col-sm-4">
              <div class="form-group">
                <label for="url">Web address</label>
                <input [disabled]="disabledInput"
                       [(ngModel)]="displayedWalk.walk.fields.venue.url"
                       type="text" class="form-control input-sm"
                       id="url"
                       placeholder="Enter web address">
              </div>
            </div>
            @if (allowEdits()) {
              <div class="col-sm-6">
                <div class="custom-control custom-checkbox">
                  <input [(ngModel)]="displayedWalk.walk.fields.venue.venuePublish"
                         [disabled]="!allowEdits()"
                         name="showDetail" class="custom-control-input" type="checkbox" class="custom-control-input"
                         id="walk-publish-venue">
                  <label class="custom-control-label"
                         for="walk-publish-venue">Publish venue on site
                  </label>
                </div>
              </div>
            }
            @if (allowEdits()) {
              <div class="col-sm-6">
                @if (displayedWalk.walk.fields.venue.url) {
                  <div class="form-group">
                    <label>Link preview:
                      <fa-icon [icon]="displayedWalk.walk.fields.venue?.type | toVenueIcon"
                               class="fa-icon fa-lg"></fa-icon>
                      <a [href]="displayedWalk.walk.fields.venue.url"
                         tooltip="Click to visit {{displayedWalk.walk.fields.venue?.name}}"
                         class="related-links-title" target="_blank">
                        {{ displayedWalk.walk.fields.venue?.name }}
                      </a>
                    </label>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    `,
    imports: [MarkdownEditorComponent, FormsModule, FontAwesomeModule, TooltipDirective, VenueIconPipe]
})
export class WalkVenueComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkVenueComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  public display: WalkDisplayService = inject(WalkDisplayService);
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
    this.logger.debug("venue is", this.displayedWalk.walk.fields.venue, "venueTypes", this.venueTypes);
    this.disabledInput = !this.allowEdits() && !this.displayedWalk?.walk?.fields?.venue?.venuePublish;
  }

  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

}
