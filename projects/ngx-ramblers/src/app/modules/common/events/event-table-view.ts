import { Component, inject, Input } from "@angular/core";
import { NgClass } from "@angular/common";
import { faPeopleGroup, faWalking } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk } from "../../../models/walk.model";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { WalkGradingComponent } from "../../../pages/walks/walk-view/walk-grading";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { WalkViewComponent } from "../../../pages/walks/walk-view/walk-view";
import { WalkEditComponent } from "../../../pages/walks/walk-edit/walk-edit.component";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { EventLeaderContactLinkComponent } from "../../../pages/walks/walk-view/event-leader-contact-link";
import { EventLeaderPhoneLinkComponent } from "../../../pages/walks/walk-view/event-leader-phone-link";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";

@Component({
  selector: "app-event-table-view",
  styles: [`
    .table-responsive-visible
      overflow: visible
  `],
  template: `
    @for (displayedWalk of currentPageEvents; track eventTracker(index, displayedWalk); let index = $index) {
      @if (display.isExpanded(displayedWalk?.walk)) {
        <div class="table-responsive mt-2">
          @if (!display.isEdit(displayedWalk?.walk)) {
            <app-walk-view [displayedWalk]="displayedWalk"/>
          }
          @if (display.isEdit(displayedWalk?.walk)) {
            <app-walk-edit [displayedWalk]="displayedWalk"/>
          }
        </div>
      }
    }
    <table class="rounded table styled-table table-hover table-sm table-responsive-visible mt-2">
      <thead class="styled-table">
      <tr>
        @if ((display.walkPopulationLocal() || memberLoginService.allowWalkAdminEdits()) && memberLoginService.memberLoggedIn()) {
          <th class="action" width="8%">Action</th>
        }
        <th width="8%">Type</th>
        <th width="13%">Date</th>
        <th class="d-none d-lg-table-cell" width="7%">Start Time</th>
        <th width="25%">Title</th>
        <th class="d-none d-lg-table-cell" width="7%">Distance</th>
        <th class="d-none d-lg-table-cell" width="8%">Postcode</th>
        <th class="d-none d-lg-table-cell" width="12%">Leader</th>
        @if (display.walkContactDetailsPublic()) {
          <th class="d-none d-lg-table-cell" width="14%">Contact Phone</th>
        }
      </tr>
      </thead>
      <tbody>
      @for (displayedWalk of currentPageEvents; track eventTracker(index, displayedWalk); let index = $index) {
        @if (!display.isExpanded(displayedWalk?.walk)) {
          <tr [ngClass]="tableRowEven(displayedWalk)? 'default': 'active'">
            @if ((display.walkPopulationLocal() || memberLoginService.allowWalkAdminEdits()) && memberLoginService.memberLoggedIn()) {
              <td id="eventAction-{{index}}" class="nowrap action" width="7%">
                @if (displayedWalk?.walkAccessMode?.walkWritable) {
                  <input type="submit"
                         value="{{displayedWalk?.walkAccessMode?.caption}}"
                         (click)="display.edit(displayedWalk)"
                         class="btn btn-primary">
                }
              </td>
            }
            <td width="8%" class="event-type" (click)="display.view(displayedWalk?.walk)" id="eventType-{{index}}">
              @if (display.isWalk(displayedWalk?.walk)) {
                <app-walk-grading [grading]="displayedWalk?.walk?.groupEvent?.difficulty?.code"/>
              }
              @if (!display.isWalk(displayedWalk.walk)) {
                <fa-icon class="{{display.eventType(displayedWalk.walk)}}"
                         tooltip="{{display.eventTypeTitle(displayedWalk.walk)}}" adaptivePosition
                         [icon]="display.isWalk(displayedWalk.walk)? faWalking: faPeopleGroup"/>
              }
            </td>
            <td width="13%" (click)="display.view(displayedWalk.walk)" id="eventDate-{{index}}" class="nowrap walk-date">
              {{ displayedWalk.walk?.groupEvent?.start_date_time|displayDate }}
            </td>
            <td width="7%" class="d-none d-lg-table-cell start-time" (click)="display.view(displayedWalk.walk)"
                id="startTime-{{index}}">{{ displayedWalk.walk?.groupEvent?.start_date_time| displayTime }}
            </td>
            <td width="25%" name="title" (click)="display.view(displayedWalk.walk)"
                id="briefDescription-{{index}}">{{ displayedWalk.walk?.groupEvent?.title || displayedWalk?.latestEventType?.description }}
            </td>
            <td width="7%" class="d-none d-lg-table-cell distance" (click)="display.view(displayedWalk.walk)"
                id="distance-{{index}}">{{ distanceValidationService.walkDistances(displayedWalk.walk) }}
            </td>
            <td width="8%" class="d-none d-lg-table-cell postcode" id="postcode-{{index}}">
              <a [href]="'http://maps.google.co.uk/maps?q=' + displayedWalk.walk?.groupEvent?.start_location?.postcode"
                 target="_blank" name="postcode"
                 tooltip="Click to locate postcode {{displayedWalk.walk?.groupEvent?.start_location?.postcode}} on Google Maps"
                 placement="left">{{ displayedWalk.walk?.groupEvent?.start_location?.postcode }}</a>
            </td>
            <td width="12%" class="d-none d-lg-table-cell walk-leader" id="contactEmail-{{index}}">
              <app-event-leader-contact-link [walk]="displayedWalk.walk"/>
            </td>
            @if (display.walkContactDetailsPublic()) {
              <td width="14%" class="d-none d-lg-table-cell contact-phone" id="contactPhone-{{index}}" name="contactPhone">
                <div class="d-flex align-items-start justify-content-between">
                  <app-event-leader-phone-link
                    [phone]="displayedWalk.walk?.fields?.contactDetails?.phone"
                    [displayName]="displayedWalk.walk?.fields?.contactDetails?.displayName"/>
                  <app-walk-panel-expander [walk]="displayedWalk.walk" [expandable]="true"/>
                </div>
              </td>
            }
          </tr>
        }
      }
      </tbody>
      <tfoot>
      <tr>
        <td [attr.colspan]="totalColumns()">&nbsp;</td>
      </tr>
      </tfoot>
    </table>
  `,
  imports: [NgClass, FontAwesomeModule, TooltipDirective, WalkGradingComponent, WalkPanelExpanderComponent, WalkViewComponent, WalkEditComponent, DisplayDatePipe, DisplayTimePipe, EventLeaderContactLinkComponent, EventLeaderPhoneLinkComponent]
})
export class EventTableView {

  display = inject(WalkDisplayService);
  memberLoginService = inject(MemberLoginService);
  distanceValidationService = inject(DistanceValidationService);
  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;

  @Input() currentPageEvents: DisplayedWalk[] = [];

  eventTracker(_index: number, walk: DisplayedWalk) {
    return walk.walk.id;
  }

  showTableHeader(walk: DisplayedWalk) {
    return this.currentPageEvents.indexOf(walk) === 0 ||
      this.display.isExpanded(this.currentPageEvents[this.currentPageEvents.indexOf(walk) - 1].walk);
  }

  tableRowEven(walk: DisplayedWalk) {
    return this.currentPageEvents.indexOf(walk) % 2 !== 0;
  }

  totalColumns(): number {
    let columns = 7;
    if ((this.display.walkPopulationLocal() || this.memberLoginService.allowWalkAdminEdits()) && this.memberLoginService.memberLoggedIn()) {
      columns++;
    }
    if (this.display.walkContactDetailsPublic()) {
      columns++;
    }
    return columns;
  }
}
