import { Component, inject, Input } from "@angular/core";
import { NgClass } from "@angular/common";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { faPeopleGroup, faWalking } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk } from "../../../models/walk.model";
import { SystemConfig } from "../../../models/system.model";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalkGradingComponent } from "../../../pages/walks/walk-view/walk-grading";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { WalkViewComponent } from "../../../pages/walks/walk-view/walk-view";
import { WalkEditComponent } from "../../../pages/walks/walk-edit/walk-edit.component";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { LoginModalComponent } from "../../../pages/login/login-modal/login-modal.component";

@Component({
  selector: "app-event-table-view",
  template: `
    @for (displayedWalk of currentPageEvents; track eventTracker(index, displayedWalk); let index = $index) {
      <div class="table-responsive mt-2">
        @if (display.isExpanded(displayedWalk?.walk)) {
          <div>
            @if (!display.isEdit(displayedWalk?.walk)) {
              <app-walk-view [displayedWalk]="displayedWalk"/>
            }
            @if (display.isEdit(displayedWalk?.walk)) {
              <app-walk-edit [displayedWalk]="displayedWalk"/>
            }
          </div>
        }
        @if (!display.isExpanded(displayedWalk?.walk)) {
          <table class="rounded table styled-table table-striped table-hover table-sm">
            @if (showTableHeader(displayedWalk)) {
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
                  <th class="d-none d-lg-table-cell" width="11%">Contact Phone</th>
                }
              </tr>
              </thead>
            }
            <tbody>
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
                  id="distance-{{index}}">{{ displayedWalk.walk?.groupEvent?.distance_miles }}
              </td>
              <td width="8%" class="d-none d-lg-table-cell postcode" id="postcode-{{index}}">
                <a [href]="'http://maps.google.co.uk/maps?q=' + displayedWalk.walk?.groupEvent?.start_location?.postcode"
                   target="_blank" name="postcode"
                   tooltip="Click to locate postcode {{displayedWalk.walk?.groupEvent?.start_location?.postcode}} on Google Maps"
                   placement="left">{{ displayedWalk.walk?.groupEvent?.start_location?.postcode }}</a>
              </td>
              <td width="12%" class="d-none d-lg-table-cell walk-leader" id="contactEmail-{{index}}">
                @if (allowDetailView()) {
                  <a [href]="'mailto:'+ displayedWalk.walk?.fields?.contactDetails?.email"
                     tooltip="Click to email {{displayedWalk.walk?.fields?.contactDetails?.phone}} at {{displayedWalk.walk?.fields?.contactDetails?.email}}"
                     placement="left">{{ displayedWalk.walk?.fields?.contactDetails?.phone }}</a>
                }
                @if (!allowDetailView()) {
                  <div class="tooltip-link" placement="left"
                       (click)="login()"
                       tooltip="Click to login as an {{systemConfig?.group?.shortName}} member and send an email to {{displayedWalk.walk?.fields?.contactDetails?.displayName}}">
                    {{ displayedWalk.walk?.fields?.contactDetails?.displayName }}
                  </div>
                }
              </td>
              @if (display.walkContactDetailsPublic()) {
                <td width="11%" class="d-none d-lg-table-cell contact-phone" id="contactPhone-{{index}}" name="contactPhone">
                  @if (allowDetailView()) {
                    <a [href]="'tel:' + displayedWalk.walk?.fields?.contactDetails?.phone"
                       [textContent]="displayedWalk.walk?.fields?.contactDetails?.displayName"
                       tooltip="Click to ring {{displayedWalk.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk.walk?.fields?.contactDetails?.phone}} (mobile devices only)"
                       placement="left"></a>
                  }
                  @if (!allowDetailView()) {
                    <a [href]="'tel:' + displayedWalk.walk?.fields?.contactDetails?.phone">
                      <span [textContent]="displayedWalk.walk?.fields?.contactDetails?.phone"
                            tooltip="Click to ring {{displayedWalk.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk.walk?.fields?.contactDetails?.phone}} (mobile devices only)"
                            placement="left"></span></a>
                  }
                  <app-walk-panel-expander class="d-none d-lg-inline" [walk]="displayedWalk.walk" [expandable]="true"/>
                </td>
              }
            </tr>
            </tbody>
          </table>
        }
      </div>
    }
  `,
  imports: [NgClass, FontAwesomeModule, TooltipDirective, WalkGradingComponent, WalkPanelExpanderComponent, WalkViewComponent, WalkEditComponent, DisplayDatePipe, DisplayTimePipe]
})
export class EventTableView {

  private modalService = inject(BsModalService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(WalkDisplayService);
  memberLoginService = inject(MemberLoginService);
  systemConfig: SystemConfig;
  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;

  @Input() currentPageEvents: DisplayedWalk[] = [];

  private config: ModalOptions = {animated: false, initialState: {}};

  constructor() {
    this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
    });
  }

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

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  login() {
    this.modalService.show(LoginModalComponent, this.config);
  }
}
