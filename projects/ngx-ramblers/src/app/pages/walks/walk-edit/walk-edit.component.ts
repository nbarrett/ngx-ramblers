import { Component, inject, Input, OnDestroy, OnInit, Type, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { faMagnifyingGlass, faPencil } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ConfigKey } from "../../../models/config.model";
import { DateValue } from "../../../models/date.model";
import { MEETUP_API_AVAILABLE, MeetupConfig } from "../../../models/meetup-config.model";
import { DisplayMember, Member } from "../../../models/member.model";
import { ConfirmType } from "../../../models/ui-actions";
import { DisplayedEvent } from "../../../models/walk-displayed-event.model";
import { WalkEventType } from "../../../models/walk-event-type.model";
import { WalkEvent } from "../../../models/walk-event.model";
import {
  DisplayedWalk,
  EventType,
  INITIALISED_LOCATION,
  Links,
  LinkSource,
  WalkExport,
  WalkType,
  WalkViewMode
} from "../../../models/walk.model";
import { ChangedItemsPipe } from "../../../pipes/changed-items.pipe";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { EventNotePipe } from "../../../pipes/event-note.pipe";
import { FullNameWithAliasOrMePipe } from "../../../pipes/full-name-with-alias-or-me.pipe";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { sortBy } from "../../../functions/arrays";
import { BroadcastService } from "../../../services/broadcast-service";
import { ConfigService } from "../../../services/config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { GroupEventService } from "../../../services/walks/group-event.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksAndEventsService } from "../../../services/walks/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailMessagingConfig } from "../../../models/mail.model";
import { MeetupService } from "../../../services/meetup.service";
import { WalkNotification, WalksConfig } from "../../../models/walk-notification.model";
import { MeetupDescriptionComponent } from "../../../notifications/walks/templates/meetup/meetup-description.component";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { DatePicker } from "../../../date-and-time/date-picker";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { WalkRiskAssessmentComponent } from "../walk-risk-assessment/walk-risk-assessment.component";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkVenueComponent } from "../walk-venue/walk-venue.component";
import { WalkMeetupComponent } from "../walk-meetup/walk-meetup.component";
import { WalkSummaryPipe } from "../../../pipes/walk-summary.pipe";
import { SystemConfig } from "../../../models/system.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { EditGropuEventImagesComponent } from "./edit-group-event-images";
import { JsonPipe } from "@angular/common";
import { WalkEditFeaturesComponent } from "./walk-edit-features";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { LinksService } from "../../../services/links.service";
import { EventDefaultsService } from "../../../services/event-defaults.service";
import { NotificationComponent } from "../../../notifications/common/notification.component";
import { TimePicker } from "../../../date-and-time/time-picker";
import { EventDistanceEdit } from "./event-distance-edit";
import { EventAscentEdit } from "./event-ascent-edit.component";
import { Difficulty } from "../../../models/ramblers-walks-manager";

@Component({
  selector: "app-walk-edit",
  template: `
    <div class="d-none">
      <ng-template app-notification-directive/>
    </div>
    <div class="tabset-container">
      <app-walk-panel-expander [walk]="displayedWalk.walk" [collapsable]="true" [collapseAction]="'exit edit'"
                               [expandAction]="'edit walk full-screen'" [expandable]="isExpandable()"/>
      <tabset class="custom-tabset">
        <tab heading="Main Details">
          <div class="img-thumbnail thumbnail-admin-edit">
            <div class="row align-items-center">
              <div class="col-auto">
                <label for="walk-date">Walk Date</label>
                <div class="form-group">
                  <app-date-picker id="walk-date" size="md"
                                   placeholder="enter date of walk"
                                   [disabled]="!display.allowAdminEdits() || inputDisabled()"
                                   class="w-100"
                                   (dateChange)="onDateChange($event)"
                                   [value]="displayedWalk.walk.groupEvent.start_date_time"/>
                </div>
              </div>
              <div class="col-auto">
                <div class="form-group" app-time-picker id="start-time" label="Start Time" [disabled]="inputDisabled()"
                     [value]="displayedWalk.walk.groupEvent.start_date_time"
                     (change)="onStartDateTimeChange($event)">
                </div>
              </div>
              <div class="col-auto">
                <div class="form-group" app-event-distance-edit label="Distance" [groupEvent]="displayedWalk.walk.groupEvent"
                     (change)="calculateAndSetFinishTime()" [disabled]="inputDisabled()"></div>
              </div>
              <div class="col">
                <div class="form-group">
                  <label for="miles-per-hour">Average Miles Per Hour</label>
                  <input [disabled]="inputDisabled()"
                         [(ngModel)]="displayedWalk.walk.fields.milesPerHour"
                         (ngModelChange)="calculateAndSetFinishTime()"
                         type="number" step="0.25"
                         class="form-control input-sm"
                         id="miles-per-hour"
                         placeholder="Enter Estimated MPH of walk">
                </div>
              </div>
              <div class="col-auto">
                <div class="form-group" app-time-picker id="end-time" label="Estimated Finish Time"
                     [disabled]="inputDisabled()"
                     [value]="displayedWalk.walk.groupEvent.end_date_time"
                     (change)="onEndDateTimeChange($event)"></div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-12">
                <div class="form-group">
                  <label for="brief-description-and-start-point">Walk Title</label>
                  <textarea [disabled]="inputDisabled()"
                            [(ngModel)]="displayedWalk.walk.groupEvent.title" type="text"
                            class="form-control input-sm" rows="3"
                            id="brief-description-and-start-point"
                            placeholder="Enter walk title here"></textarea>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-12">
                <div class="form-group">
                  <label for="longer-description">Walk Description <a
                    [hidden]="longerDescriptionPreview"
                    (click)="previewLongerDescription()" [href]="">
                    <fa-icon [icon]="faMagnifyingGlass" class="markdown-preview-icon"></fa-icon>
                    preview</a>
                    @if (longerDescriptionPreview) {
                      <a
                        (click)="editLongerDescription()" [href]="">
                        <fa-icon [icon]="faPencil" class="markdown-preview-icon"/>
                        edit</a>
                    } </label>
                  @if (longerDescriptionPreview) {
                    <p
                      (click)="editLongerDescription()"
                      class="list-arrow" markdown [data]="displayedWalk.walk.groupEvent.description"
                      type="text"
                      id="longer-description-formatted"></p>
                  }
                  @if (!longerDescriptionPreview) {
                    <textarea
                      [disabled]="inputDisabled()"
                      [(ngModel)]="displayedWalk.walk.groupEvent.description" type="text"
                      class="form-control input-sm" rows="5" id="longer-description"
                      placeholder="Enter Walk Description here"></textarea>
                  }
                </div>
              </div>
            </div>
          </div>
        </tab>
        @if (true) {
          <tab (selectTab)="onTabSelect(true)" heading="Walk Details">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <div class="row">
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="grade">Grade</label>
                        @if (allowDetailView()) {
                          <select [compareWith]="difficultyComparer" [disabled]="inputDisabled()"
                                  placeholder="Enter Grade here"
                                  [(ngModel)]="displayedWalk.walk.groupEvent.difficulty"
                                  (ngModelChange)="difficultyChange()"
                                  class="form-control input-sm" id="grade">
                            @for (difficulty of display.difficulties(); track difficulty.code) {
                              <option
                                [ngValue]="difficulty">{{ difficulty.description }}
                              </option>
                            }
                          </select>
                        }
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="walkType">Walk Type</label>
                        @if (allowDetailView()) {
                          <select [disabled]="inputDisabled()"
                                  [(ngModel)]="displayedWalk.walk.groupEvent.shape"
                                  (ngModelChange)="walkTypeChange()"
                                  class="form-control input-sm" id="walkType">
                            @for (type of display.walkTypes; track type) {
                              <option [ngValue]="type"
                                      [attr.selected]="type == display.walkTypes[0]">{{ type }}
                              </option>
                            }
                          </select>
                        }
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <label for="ascent">Ascent</label>
                      <div class="form-group" app-event-ascent-edit [groupEvent]="displayedWalk.walk.groupEvent"
                           id="ascent" [disabled]="inputDisabled()"></div>
                    </div>
                  </div>
                </div>
              </div>
              @if (renderMapEdit) {
                <div class="row">
                  <div class="col">
                    <app-walk-location-edit locationType="Starting"
                                            [locationDetails]="displayedWalk.walk.groupEvent.start_location"
                                            [notify]="notify"/>
                  </div>
                  @if (displayedWalk?.walk?.groupEvent?.shape === WalkType.LINEAR) {
                    <div class="col">
                      <app-walk-location-edit locationType="Finishing"
                                              [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                              [notify]="notify"/>
                    </div>
                  }
                </div>
                @if (displayedWalk?.walk?.groupEvent?.shape === WalkType.LINEAR) {
                  <div class="row mt-2">
                    <div class="col d-flex justify-content-center">
                      <button type="button" class="btn btn-primary"
                              (click)="swapStartAndEndLocations()">
                        Swap Start & End Locations
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </tab>
          @if (display.allowEdits(displayedWalk.walk)) {
            <tab heading="Risk Assessment">
              <app-walk-risk-assessment [displayedWalk]="displayedWalk"/>
            </tab>
          }
          <tab heading="Related Links">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <div class="img-thumbnail thumbnail-walk-edit">
                    <div class="thumbnail-heading">Ramblers</div>
                    <div class="form-group">
                      @if (!insufficientDataToUploadToRamblers() && !ramblersWalkExists()) {
                        <p>
                          This walk has not been
                          uploaded to Ramblers yet - check back when date is closer to
                          <b>{{ displayedWalk.walk.groupEvent.start_date_time | displayDate }}</b>.
                        </p>
                      }
                      @if (insufficientDataToUploadToRamblers()) {
                        <p>
                          {{ walkValidations() }}
                        </p>
                      }
                      @if (canUnlinkRamblers()) {
                        <div>
                          <div class="row">
                            <div class="col-sm-2">
                              <input type="submit" value="Unlink"
                                     (click)="unlinkRamblersDataFromCurrentWalk()"
                                     title="Remove link between this walk and Ramblers"
                                     class="btn btn-primary">
                            </div>
                            <div class="col-sm-10">
                              <app-markdown-editor name="ramblers-help"
                                                   description="Linking to Ramblers"></app-markdown-editor>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                    <div class="row">
                      @if (display.allowEdits(displayedWalk.walk)) {
                        <div class="col-sm-6">
                          <div class="custom-control custom-checkbox">
                            <input [disabled]="inputDisabled() || saveInProgress"
                                   [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.publish"
                                   type="checkbox" class="custom-control-input" id="publish-ramblers">
                            <label class="custom-control-label" for="publish-ramblers">Publish to Ramblers
                            </label>
                          </div>
                        </div>
                      }
                      @if (ramblersWalkExists()) {
                        <div class="col-sm-6">
                          <div class="form-group">
                            <label class="mr-2">Link preview:</label>
                            <img class="related-links-ramblers-image"
                                 src="favicon.ico"
                                 alt="Click to view on Ramblers Walks and Events Manager"/>
                            <a target="_blank"
                               class="ml-2"
                               tooltip="Click to view on Ramblers Walks and Events Manager"
                               [href]="display.ramblersLink(displayedWalk.walk)">Ramblers</a>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
                @if (displayedWalk?.walk?.fields?.venue) {
                  <app-walk-venue [displayedWalk]="displayedWalk"/>
                }
                <app-walk-meetup [displayedWalk]="displayedWalk" [saveInProgress]="saveInProgress"/>
                <div class="col-sm-12">
                  <div class="row img-thumbnail thumbnail-walk-edit">
                    <div class="thumbnail-heading">OS Maps</div>
                    <div class="row">
                      <div class="col-sm-12">
                        <app-markdown-editor name="os-maps-help" description="Linking to OS Maps"/>
                      </div>
                    </div>
                    <div class="row">
                      @if (links?.osMapsRoute?.href) {
                        <div class="col-sm-6">
                          <div class="form-group">
                            <label for="os-maps-route">Url</label>
                            <input
                              [(ngModel)]="this.links.osMapsRoute.href"
                              [disabled]="inputDisabled()"
                              type="text" value="" class="form-control input-sm"
                              id="os-maps-route"
                              placeholder="Enter URL to OS Maps Route">
                          </div>
                        </div>
                        <div class="col-sm-6">
                          <div class="form-group">
                            <label for="related-links-title">Title</label>
                            <input [(ngModel)]="links.osMapsRoute.title"
                                   [disabled]="inputDisabled()"
                                   type="text" value="" class="form-control input-sm"
                                   id="related-links-title"
                                   placeholder="Enter optional title for OS Maps link">
                          </div>
                        </div>
                      }
                      <div class="col-sm-12">
                        @if (links?.osMapsRoute?.href) {
                          <div class="form-inline">
                            <label>Link preview:</label>
                            <img class="related-links-image ml-2"
                                 src="/assets/images/local/ordnance-survey.png"
                                 alt=""/>
                            <a target="_blank"
                               class="ml-2"
                               [href]="links.osMapsRoute.href"
                               tooltip="Click to view the route for this walk on Ordnance Survey Maps">
                              {{ links.osMapsRoute.title || displayedWalk.walk.groupEvent.title }}
                            </a>
                            <input type="submit" value="Unlink"
                                   (click)="unlinkOSMapsFromCurrentWalk()"
                                   title="Remove link between this walk and OS Maps"
                                   [disabled]="!canUnlinkOSMaps()|| inputDisabled()"
                                   class="btn btn-primary ml-2">
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Walk Leader">
            <div class="img-thumbnail thumbnail-admin-edit">
              @if (display.allowAdminEdits()) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <div class="custom-control custom-radio custom-control-inline">
                        <input id="showOnlyWalkLeadersTrue" type="radio" class="custom-control-input"
                               name="showOnlyWalkLeaders"
                               [(ngModel)]="showOnlyWalkLeaders" [value]="true">
                        <label class="custom-control-label" for="showOnlyWalkLeadersTrue">
                          Show Only Walk Leaders ({{ previousWalkLeadersWithAliasOrMe().length }})</label>
                      </div>
                      <div class="custom-control custom-radio custom-control-inline">
                        <input id="showOnlyWalkLeadersFalse" type="radio" class="custom-control-input"
                               name="showOnlyWalkLeaders"
                               [(ngModel)]="showOnlyWalkLeaders" [value]="false">
                        <label class="custom-control-label" for="showOnlyWalkLeadersFalse">
                          Show All Members ({{ membersWithAliasOrMe().length }})</label>
                      </div>
                    </div>
                  </div>
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="walk-status">Walk Status</label>
                      <select [disabled]="!display.allowAdminEdits()"
                              [(ngModel)]="displayedWalk.status"
                              (change)="walkStatusChange()"
                              class="form-control input-sm" id="walk-status">
                        @for (status of walkStatuses(); track status.eventType) {
                          <option
                            [ngValue]="status.eventType"
                            [textContent]="status.description">
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                </div>
              }
              @if (display.allowAdminEdits()) {
                <div class="row">
                  <div class="col-sm-10">
                    <div class="form-group">
                      <label for="contact-member">Walk Leader</label>
                      @if (allowDetailView() && displayedWalk?.walk?.fields?.contactDetails) {
                        <select [disabled]="!display.allowAdminEdits()"
                                (change)="walkLeaderMemberIdChanged()"
                                [(ngModel)]="displayedWalk.walk.fields.contactDetails.memberId"
                                class="form-control" id="contact-member">
                          <option value="">(no walk leader selected)</option>
                          @for (member of memberLookup(); track member.memberId) {
                            <option [ngValue]="member.memberId">{{ member.name }}</option>
                          }
                        </select>
                      }
                    </div>
                  </div>
                  <div class="col-sm-2">
                    <div class="form-group">
                      <input type="submit" [disabled]="saveInProgress" value="Me" (click)="setWalkLeaderToMe()"
                             class="btn btn-primary button-bottom-aligned w-100">
                    </div>
                  </div>
                </div>
              }
              @if (display.allowAdminEdits()) {
                <div class="row">
                  <div class="col-sm-5">
                    <div class="form-group">
                      <label for="display-name">Display Name (how it will be published on this walk)</label>
                      <input [(ngModel)]="displayedWalk.walk.fields.contactDetails.displayName"
                             type="text"
                             class="form-control input-sm" id="display-name"
                             placeholder="Name as displayed to the public and sent to Ramblers in CSV export file">
                    </div>
                  </div>
                  <div class="col-sm-5">
                    <div class="form-group">
                      <label for="walk-leader-contact-id">Walks Manager Contact Name</label>
                      <input [disabled]="inputDisabled()"
                             [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.contactName"
                             type="text"
                             class="form-control input-sm flex-grow-1 mr-2" id="walk-leader-contact-id"
                             placeholder="Name that matches the User Details in Assemble. This will be sent in Ramblers in CSV export file">
                    </div>
                  </div>
                  <div class="col-sm-2">
                    <div class="form-group">
                      <input type="submit" [value]="toggleRamblersWalkLeaderContactName()"
                             (click)="toggleRamblersWalkLeader()"
                             [disabled]="saveInProgress"
                             class="btn btn-primary button-bottom-aligned w-100">
                    </div>
                  </div>
                </div>
              }
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <label for="contact-phone">Contact Phone</label>
                    <input [disabled]="inputDisabled()" [(ngModel)]="displayedWalk.walk.fields.contactDetails.phone"
                           type="text" class="form-control input-sm" id="contact-phone"
                           placeholder="Enter contact phone here">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <label for="contact-email">Contact Email</label>
                    @if (allowDetailView()) {
                      <input [disabled]="inputDisabled()"
                             [(ngModel)]="displayedWalk.walk.fields.contactDetails.email" type="text"
                             class="form-control input-sm" id="contact-email"
                             placeholder="Enter contact email here">
                    }
                    @if (!allowDetailView()) {
                      <input [disabled]="true"
                             value="(login to see this)" type="text"
                             class="form-control input-sm"
                             id="contact-email-hidden">
                    }
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab app-walk-edit-features heading="Features"
               [displayedWalk]="displayedWalk"
               [config]="config"/>
          <tab app-edit-group-event-images heading="Images"
               [extendedGroupEvent]="displayedWalk.walk"
               [config]="config"/>
          @if (display.walkLeaderOrAdmin(displayedWalk.walk)) {
            <tab heading="History">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="form-group">
                  <table
                    class="round styled-table table-striped table-hover table-sm table-pointer">
                    <thead>
                    <tr>
                      <th>Date</th>
                      <th>Who</th>
                      <th>Description</th>
                      <th>Notes</th>
                    </tr>
                    </thead>
                    <tbody>
                      @for (event of walkEvents(displayedWalk.walk); track event.date) {
                        <tr>
                          <td style="width: 25%" [textContent]="event.date"></td>
                          <td style="width: 15%"
                              [textContent]="event.member"></td>
                          <td style="width: 20%"
                              [textContent]="event.eventType"></td>
                          <td style="width: 40%"><span
                            tooltip="Details: {{event.changedItems}}">{{ event.notes }}</span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </tab>
          }
          @if (displayedWalk?.walk?.fields?.contactDetails?.memberId) {
            <tab heading="Copy From...">
              @if (display.allowEdits(displayedWalk.walk) && displayedWalk?.walk?.fields?.contactDetails?.memberId) {
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row">
                    <div class="col-sm-12">
                      <div class="img-thumbnail thumbnail-walk-edit">
                        <div class="thumbnail-heading">Create {{ myOrWalkLeader() }} walk based on an existing one
                        </div>
                        <ng-container>
                          <div class="row">
                            <div class="col-sm-12">
                              <div class="custom-control custom-radio custom-control-inline">
                                <input id="copy-selected-walk-leader"
                                       type="radio"
                                       class="custom-control-input"
                                       [(ngModel)]="copySource"
                                       (change)="populateWalkTemplates()"
                                       value="copy-selected-walk-leader"/>
                                <label class="custom-control-label" for="copy-selected-walk-leader">Previously led
                                  by:
                                  <select
                                    [disabled]="copySource!=='copy-selected-walk-leader'"
                                    class="input-md input-led-by"
                                    [(ngModel)]="copySourceFromWalkLeaderMemberId"
                                    (ngModelChange)="copySelectedWalkLeader()"
                                    id="copy-member-walks">
                                    <option value="">(no walk leader selected)</option>
                                    @for (member of previousWalkLeadersWithAliasOrMe(); track member.memberId) {
                                      <option
                                        [ngValue]="member.memberId">{{ member.name }}
                                      </option>
                                    }
                                  </select>
                                </label>
                              </div>
                              <div class="custom-control custom-radio custom-control-inline">
                                <input id="copy-with-os-maps-route-selected"
                                       type="radio"
                                       class="custom-control-input"
                                       [(ngModel)]="copySource"
                                       (change)="populateWalkTemplates()"
                                       value="copy-with-os-maps-route-selected"/>
                                <label class="custom-control-label" for="copy-with-os-maps-route-selected">
                                  With an OS Maps route I can follow</label>
                              </div>
                            </div>
                          </div>
                          @if (copyFrom) {
                            <div class="row">
                              <div class="col-sm-12 mt-2">
                                <label for="copy-walks-list">
                                  Copy from {{ copyFrom?.walkTemplates?.length || 0 }} available walk(s): </label>
                                <select [disabled]="inputDisabled()" class="form-control input-sm"
                                        [(ngModel)]="copyFrom.walkTemplate"
                                        (ngModelChange)="copyDetailsFromPreviousWalk()"
                                        id="copy-walks-list">
                                  <option value="">(none selected)</option>
                                  @for (walkTemplate of copyFrom.walkTemplates; track walkTemplate) {
                                    <option
                                      [ngValue]="walkTemplate">{{ walkTemplate | walkSummary }}
                                    </option>
                                  }
                                </select>
                              </div>
                            </div>
                          }
                        </ng-container>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </tab>
          }
        }
      </tabset>
    </div>
    <div class="form-group">
      @if (notifyTarget.showAlert) {
        <div class="alert {{notifyTarget.alertClass}}">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          <strong> {{ notifyTarget.alertTitle }}: </strong>
          {{ notifyTarget.alertMessage }}
        </div>
      }
    </div>
    @if (displayedWalk.walk) {
      <div class="form-inline mb-4 align-middle">
        @if (this.showChangedItems) {
          changedItems: {{ this.walkEventService.walkDataAuditFor(this.displayedWalk.walk, this.status(), true)?.changedItems | json }}
        }
        @if (allowClose()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Close"
                 (click)="closeEditView()" title="Close and go back to walks list"
                 class="btn btn-primary mr-2">
        }
        @if (allowSave()) {
          <input [disabled]="saveInProgress" type="submit" value="Save"
                 (click)="saveWalkDetails()" title="Save these walk details"
                 class="btn btn-primary mr-2">
        }
        @if (allowCancel()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Cancel"
                 (click)="cancelWalkDetails()" title="Cancel and don't save"
                 class="btn btn-primary mr-2">
        }
        @if (pendingCancel()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Confirm" (click)="confirmCancelWalkDetails()"
                 title="Confirm losing my changes and closing this form"
                 class="btn btn-primary mr-2">
        }
        @if (allowDelete()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Delete"
                 (click)="deleteWalkDetails()" title="Delete these walk details"
                 class="btn btn-primary mr-2">
        }
        @if (pendingDelete()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Confirm Deletion" (click)="confirmDeleteWalkDetails()"
                 title="Confirm Delete of these walk details"
                 class="btn btn-primary mr-2">
        }
        @if (allowRequestApproval()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Request Approval" (click)="requestApproval()"
                 title="Mark walk details complete and request approval"
                 class="btn btn-primary mr-2">
        }
        @if (allowApprove()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Approve" (click)="approveWalkDetails()"
                 title="Approve walk and publish"
                 class="btn btn-primary mr-2">
        }
        @if (pendingRequestApproval()) {
          <input [disabled]="saveInProgress"
                 type="submit"
                 value="Confirm Request Approval" (click)="confirmRequestApproval()"
                 title="Confirm walk details complete and request approval"
                 class="btn btn-primary mr-2">
        }
        @if (allowContactOther()) {
          <input [disabled]="saveInProgress" type="submit"
                 value=""
                 (click)="contactOther()" title="Contact {{personToNotify()}}"
                 class="btn btn-primary mr-2">
        }
        @if (pendingContactOther()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Contact {{personToNotify()}}" (click)="confirmContactOther()"
                 title="Contact {{personToNotify()}} via email"
                 class="btn btn-primary mr-2">
        }
        @if (pendingConfirmation()) {
          <input type="submit" value="Cancel" (click)="cancelConfirmableAction()"
                 title="Cancel this action"
                 class="btn btn-primary mr-2">
        }
        @if (allowNotifyConfirmation() && !saveInProgress) {
          <div class="custom-control custom-checkbox">
            <input [disabled]="!display.allowAdminEdits() ||saveInProgress "
                   [(ngModel)]="sendNotifications"
                   type="checkbox" class="custom-control-input" id="send-notification">
            <label class="custom-control-label ml-2"
                   for="send-notification">Notify {{ personToNotify() }} about this change
            </label>
          </div>
        }
      </div>
    }`,
  styleUrls: ["./walk-edit.component.sass"],
  imports: [NotificationDirective, WalkPanelExpanderComponent, TabsetComponent, TabDirective, DatePicker,
    FormsModule, FontAwesomeModule, MarkdownComponent, WalkLocationEditComponent, WalkRiskAssessmentComponent,
    MarkdownEditorComponent, TooltipDirective, WalkVenueComponent, WalkMeetupComponent, DisplayDatePipe, WalkSummaryPipe,
    EditGropuEventImagesComponent, JsonPipe, WalkEditFeaturesComponent, TimePicker, EventDistanceEdit, EventAscentEdit]
})
export class WalkEditComponent implements OnInit, OnDestroy {

  @Input("displayedWalk")
  set initialiseWalk(displayedWalk: DisplayedWalk) {
    this.logger.info("initialiseWalk:displayedWalk groupEvent input:", displayedWalk.walk.groupEvent);
    if (displayedWalk && !displayedWalk?.walk?.groupEvent?.start_location) {
      this.logger.info("initialiseWalk:initialising walk start location with:", INITIALISED_LOCATION);
      displayedWalk.walk.groupEvent.start_location = cloneDeep(INITIALISED_LOCATION);
    }
    if (displayedWalk && !displayedWalk?.walk?.fields?.contactDetails) {
      const contactDetails = this.eventDefaultsService.defaultContactDetails();
      this.logger.info("initialiseWalk:initialising walk contactDetails with:", contactDetails);
      displayedWalk.walk.fields.contactDetails = contactDetails;
    }
    this.displayedWalk = cloneDeep(displayedWalk);
    this.initialiseMilesPerHour();
    this.logger.info("initialiseWalk:cloning groupEvent for edit:", this.displayedWalk.walk.groupEvent, "original:", displayedWalk.walk.groupEvent);
    this.mapEditComponentDisplayedWalk = this.displayedWalk;
  }

  showChangedItems: false;

  public linksService: LinksService = inject(LinksService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditComponent", NgxLoggerLevel.INFO);
  private walksConfigService = inject(WalksConfigService);
  private mailMessagingService = inject(MailMessagingService);
  googleMapsService = inject(GoogleMapsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private addressQueryService = inject(AddressQueryService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private memberLoginService = inject(MemberLoginService);
  route = inject(ActivatedRoute);
  private walksQueryService = inject(WalksQueryService);
  private walkNotificationService = inject(WalkNotificationService);
  protected walkEventService = inject(GroupEventService);
  private walksReferenceService = inject(WalksReferenceService);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private displayDateAndTime = inject(DisplayDateAndTimePipe);
  private fullNameWithAliasOrMePipe = inject(FullNameWithAliasOrMePipe);
  private eventNotePipe = inject(EventNotePipe);
  private changedItemsPipe = inject(ChangedItemsPipe);
  protected dateUtils = inject(DateUtilsService);
  display = inject(WalkDisplayService);
  stringUtils = inject(StringUtilsService);
  private displayDate = inject(DisplayDatePipe);
  protected notifierService = inject(NotifierService);
  private configService = inject(ConfigService);
  private eventDefaultsService = inject(EventDefaultsService);
  private broadcastService = inject<BroadcastService<ExtendedGroupEvent>>(BroadcastService);
  public config: SystemConfig;
  protected renderMapEdit: boolean;
  private mailMessagingConfig: MailMessagingConfig;
  public previousWalkLeaderIds: string[] = [];
  public displayedWalk: DisplayedWalk;
  public mapEditComponentDisplayedWalk: DisplayedWalk;
  public meetupService: MeetupService;
  public confirmAction: ConfirmType = ConfirmType.NONE;
  public googleMapsUrl: SafeResourceUrl;
  public walkDate: Date;
  private priorStatus: EventType;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  public saveInProgress = false;
  public sendNotifications = false;
  public longerDescriptionPreview: boolean;
  public meetupConfig: MeetupConfig;
  public faPencil = faPencil;
  public faMagnifyingGlass = faMagnifyingGlass;
  public copySource = "copy-selected-walk-leader";
  public copySourceFromWalkLeaderMemberId: string;
  public copyFrom: { walkTemplate: ExtendedGroupEvent, walkTemplates: ExtendedGroupEvent[] };
  public showOnlyWalkLeaders = true;
  private subscriptions: Subscription[] = [];
  private walkLeadContactId: string;
  private myContactId: string;
  private walksConfig: WalksConfig;
  public options: any;
  public showGoogleMapsView = false;
  protected readonly WalkType = WalkType;
  public links: Links = null;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;

  protected readonly LinkSource = LinkSource;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => this.config = config));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      if (this.mailMessagingConfig?.mailConfig.allowSendTransactional) {
        this.sendNotifications = true;
      } else if (this.memberLoginService.memberLoggedIn() && this.personToNotify()) {
        this.notify.warning({
          title: "Email notifications",
          message: this.notificationsDisabledWarning()
        });

      }
    }));
    this.previousWalkLeaderIds = await this.walksAndEventsService.queryWalkLeaders();
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.logger.info("walksConfigService:walksConfig:", walksConfig);
      this.initialiseMilesPerHour();

    }));
    this.subscriptions.push(this.display.memberEvents().subscribe(members => {
      this.refreshContactIds();
    }));
    this.logger.info("previousWalkLeaderIds:", this.previousWalkLeaderIds);
    this.copyFrom = {walkTemplate: {} as ExtendedGroupEvent, walkTemplates: [] as ExtendedGroupEvent[]};
    this.configService.queryConfig<MeetupConfig>(ConfigKey.MEETUP).then(meetupConfig => this.meetupConfig = meetupConfig);
    this.links = this.linksService.linksFrom(this.displayedWalk.walk.fields.links);
    this.showWalk(this.displayedWalk);
    this.logger.debug("displayedWalk:", this.displayedWalk);
  }

  private initialiseMilesPerHour() {
    if (this.displayedWalk.walk.fields.milesPerHour > 0) {
      this.logger.info("initialiseMilesPerHour:milesPerHour already set to:", this.displayedWalk.walk.fields.milesPerHour);
    } else if (this.walksConfig?.milesPerHour) {
      this.logger.info("initialiseMilesPerHour:setting milesPerHour from:", this.displayedWalk.walk.fields.milesPerHour, "to:", this.walksConfig.milesPerHour);
      this.displayedWalk.walk.fields.milesPerHour = this.walksConfig.milesPerHour;
    } else {
      this.logger.info("initialiseMilesPerHour:not setting as this.displayedWalk.walk:", this.displayedWalk.walk, "this.walksConfig.milesPerHour:", this.walksConfig?.milesPerHour);
    }
  }

  toggleMapView() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  private pushWalkToChild() {
    this.logger.info("displayedWalk changed:", this.displayedWalk);
    this.toggleMapView();
    this.mapEditComponentDisplayedWalk = cloneDeep(this.displayedWalk);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshContactIds() {
    this.myContactId = this.display.members.find(member => member.id === this.memberLoginService.loggedInMember().memberId)?.contactId;
    this.walkLeadContactId = this.display.members.find(member => member.id === this.displayedWalk?.walk?.fields?.contactDetails?.memberId)?.contactId;
    this.logger.info("refreshContactIds:myContactId:", this.myContactId, "walkLeadContactId:", this.walkLeadContactId);
  }

  private notificationsDisabledWarning() {
    return `Email notifications are not enabled, so ${this.personToNotify()} won't be automatically notified of changes you make.`;
  }

  private confirmChangesMessage() {
    return {
      title: "Confirm walk details complete",
      message: this.mailMessagingConfig?.mailConfig.allowSendTransactional ? this.confirmAndChangesWillBePublished() : this.notificationsDisabledWarning()
    };
  }

  private confirmAndChangesWillBePublished() {
    return `If you confirm this, your walk details will be emailed to ${this.display.walksCoordinatorName()} and they will publish these to the site.`;
  }

  notificationRequired() {
    const walkDataAudit = this.walkEventService.walkDataAuditFor(this.displayedWalk.walk, this.status(), true);
    const notificationRequired = walkDataAudit.notificationRequired;
    this.logger.debug("dataHasChanged:", notificationRequired, "walkDataAudit:", walkDataAudit);
    return notificationRequired;
  }

  inputDisabled() {
    return !this.inputEnabled();
  }

  inputEnabled() {
    return this.confirmAction === ConfirmType.NONE && !this.saveInProgress && (this.display.allowAdminEdits() ||
      this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk));
  }

  allowSave() {
    return this.inputEnabled() && this.notificationRequired();
  }

  allowClose() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && !this.allowSave();
  }

  allowCancel() {
    return !this.saveInProgress && this.inputEnabled() && this.notificationRequired();
  }

  status(): EventType {
    return this.displayedWalk.status;
  }

  allowDelete() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && this.memberLoginService.allowWalkAdminEdits()
      && this.displayedWalk.walkAccessMode && this.displayedWalk?.walkAccessMode?.walkWritable;
  }

  allowNotifyConfirmation() {
    return this.mailMessagingConfig?.mailConfig.allowSendTransactional && (this.allowSave() || this.confirmAction === ConfirmType.DELETE) && this.displayedWalk.walk.fields.contactDetails.memberId;
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  allowApprove() {
    return this.confirmAction === ConfirmType.NONE && this.memberLoginService.allowWalkAdminEdits() &&
      this.walkEventService.latestEventWithStatusChangeIs(this.displayedWalk.walk, EventType.AWAITING_APPROVAL)
      && this.status() !== EventType.APPROVED;
  }

  allowContactOther() {
    return false;
  }

  allowRequestApproval() {
    return this.confirmAction === ConfirmType.NONE && this.ownedAndAwaitingWalkDetails();
  }

  pendingCancel() {
    return this.confirmAction === ConfirmType.CANCEL;
  }

  pendingDelete() {
    return this.confirmAction === ConfirmType.DELETE;
  }

  pendingRequestApproval() {
    return this.confirmAction === ConfirmType.REQUEST_APPROVAL;
  }

  pendingContactOther() {
    return this.confirmAction === ConfirmType.CONTACT_OTHER;
  }

  pendingConfirmation() {
    return this.confirmAction !== ConfirmType.NONE;
  }

  ownedAndAwaitingWalkDetails() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) && this.status() === EventType.AWAITING_WALK_DETAILS;
  }

  setWalkLeaderToMe() {
    this.displayedWalk.walk.fields.contactDetails.memberId = this.memberLoginService.loggedInMember().memberId;
    this.walkLeaderMemberIdChanged();
  }

  toggleRamblersWalkLeader() {
    const contactId = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? this.walkLeadContactId : this.myContactId;
    const targetOverride = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "walk leader" : "you";
    if (contactId) {
      this.displayedWalk.walk.fields.publishing.ramblers.contactName = contactId;
      this.notify.success({
        title: "Walk Leader Overridden",
        message: "Walk Leader will be sent to Ramblers using walk leader as " + contactId
      });
    } else {
      this.notify.warning({
        title: "Walk Leader Override failed",
        message: "Could not Walks Manager Contact Name for " + targetOverride
      });
    }
  }

  toggleRamblersWalkLeaderContactName(): string {
    return this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "leader" : "me";
  }

  walkLeaderMemberIdChanged() {
    this.notify.hide();
    this.populateCopySourceFromWalkLeaderMemberId();
    const memberId = this.displayedWalk.walk.fields.contactDetails.memberId;
    if (!memberId) {
      this.setStatus(EventType.AWAITING_LEADER);
      this.displayedWalk.walk.fields.contactDetails.memberId = null;
      this.displayedWalk.walk.fields.publishing.ramblers.contactName = null;
      this.displayedWalk.walk.fields.contactDetails.phone = null;
      this.displayedWalk.walk.fields.contactDetails.phone = null;
      this.displayedWalk.walk.fields.contactDetails.email = null;
    } else {
      const selectedMember: Member = this.display.members.find((member: Member) => {
        return member.id === memberId;
      });
      if (selectedMember) {
        this.logger.info("selectedMember", selectedMember);
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.fields.contactDetails.memberId = selectedMember.id;
        this.displayedWalk.walk.fields.publishing.ramblers.contactName = selectedMember.contactId;
        this.displayedWalk.walk.fields.contactDetails.displayName = selectedMember.displayName;
        this.displayedWalk.walk.fields.contactDetails.phone = selectedMember.mobileNumber;
        this.displayedWalk.walk.fields.contactDetails.email = selectedMember.email;
        this.populateWalkTemplates(memberId);
      }
    }
    this.refreshContactIds();
  }

  showWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.logger.info("showWalk", displayedWalk.walk, "mailConfig:", this?.mailMessagingConfig?.mailConfig);
      if (!displayedWalk.walk.fields.venue) {
        this.logger.debug("initialising walk venue");
        displayedWalk.walk.fields.venue = {
          type: this.walksReferenceService.venueTypes()[0].type,
          postcode: displayedWalk.walk.groupEvent.start_location?.postcode
        };
      }
      this.confirmAction = ConfirmType.NONE;
      this.updateGoogleMapsUrl();
      if (this.displayedWalk.walkAccessMode.initialiseWalkLeader) {
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.fields.contactDetails.memberId = this.memberLoginService.loggedInMember().memberId;
        this.walkLeaderMemberIdChanged();
        this.notify.success({
          title: "Thanks for offering to lead this walk " + this.memberLoginService.loggedInMember().firstName + "!",
          message: "Please complete as many details you can, then click Save to allocate this slot on the walks programme. " +
            "It will be published to the public once it's approved. If you want to release this slot again, just click Cancel."
        });
      } else {
        const eventType: EventType = this.display.statusFor(this.displayedWalk.walk);
        this.logger.debug("eventType", eventType);
        if (!isEmpty(eventType)) {
          this.setStatus(eventType);
          this.priorStatus = eventType;
        }
        this.calculateAndSetFinishTimeIfNotPopulated();
      }
    } else {
      this.displayedWalk = {
        hasFeatures: false,
        showEndpoint: false,
        walkAccessMode: WalksReferenceService.walkAccessModes.add,
        walk: this.eventDefaultsService.createDefault(),
        status: EventType.AWAITING_LEADER
      };
      this.displayedWalk.latestEventType = this.display.latestEventTypeFor(this.displayedWalk.walk);
    }
    this.populateCopySourceFromWalkLeaderMemberId();
    this.populateWalkTemplates();
  }

  private updateGoogleMapsUrl() {
    this.googleMapsUrl = this.display.googleMapsUrl(false, this.displayedWalk?.walk?.groupEvent?.start_location?.postcode, this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
  }

  populateCopySourceFromWalkLeaderMemberId() {
    this.copySourceFromWalkLeaderMemberId = this.displayedWalk.walk.fields.contactDetails.memberId
      || this.memberLoginService.loggedInMember().memberId;
  }

  walkEvents(walk: ExtendedGroupEvent): DisplayedEvent[] {
    return walk.events
      .sort(sortBy("date"))
      .map((event: WalkEvent) => ({
        member: this.memberIdToFullNamePipe.transform(event.memberId, this.display.members),
        date: this.displayDateAndTime.transform(event.date),
        eventType: this.walksReferenceService.toWalkEventType(event.eventType)?.description,
        notes: this.eventNotePipe.transform(event),
        changedItems: this.changedItemsPipe.transform(event, this.display.members)
      }))
      .reverse();
  }

  membersWithAliasOrMe(): DisplayMember[] {
    return this.display.members.sort(sortBy("firstName", "lastName")).map(member => {
      return {
        memberId: member.id,
        name: this.fullNameWithAliasOrMePipe.transform(member),
        contactId: member.contactId,
        displayName: member.displayName,
        firstName: member.firstName,
        lastName: member.lastName,
        membershipNumber: member.membershipNumber
      };
    });
  }

  previousWalkLeadersWithAliasOrMe(): DisplayMember[] {
    const displayMembers = this.membersWithAliasOrMe()
      .filter(member => this.previousWalkLeaderIds?.includes(member.memberId));

    this.logger.off("previousWalkLeadersWithAliasOrMe:", displayMembers);
    return displayMembers;
  }

  copyDetailsFromPreviousWalk() {
    const walkTemplate = cloneDeep(this.copyFrom.walkTemplate) as ExtendedGroupEvent;
    if (walkTemplate) {
      const relatedMember: Member = this.display.members.find(member => member.id === walkTemplate.fields.contactDetails.memberId);
      const originalContactId = walkTemplate.fields.contactDetails.contactId;
      const contactId = relatedMember?.contactId;
      const templateDate = this.displayDate.transform(walkTemplate.groupEvent.start_date_time);
      delete walkTemplate.id;
      delete walkTemplate.events;
      delete walkTemplate.groupEvent.start_date_time;
      walkTemplate.fields.contactDetails = this.eventDefaultsService.contactDetailsFrom(relatedMember);
      walkTemplate.fields.links = [];
      walkTemplate.fields.riskAssessment = [];
      if (contactId) {
        this.logger.info("copyDetailsFromPreviousWalk:updating contactId from", originalContactId, "to", contactId);
        walkTemplate.fields.contactDetails.contactId = contactId;
      } else {
        this.logger.info("copyDetailsFromPreviousWalk:cannot find contact Id to overwrite copied walk contact Id with:", originalContactId);
      }

      this.logger.info("copyDetailsFromPreviousWalk:Applying walkTemplate:", walkTemplate, "to:", cloneDeep(this.displayedWalk.walk));
      this.displayedWalk.walk = {...this.displayedWalk.walk, ...walkTemplate};
      this.logger.info("copyDetailsFromPreviousWalk:Walk is now:", this.displayedWalk.walk);
      const event = this.walkEventService.createEventIfRequired(this.displayedWalk.walk,
        EventType.WALK_DETAILS_COPIED, "Copied from previous walk on " + templateDate);
      this.setStatus(EventType.AWAITING_WALK_DETAILS);
      this.walkEventService.writeEventIfRequired(this.displayedWalk.walk, event);
      this.notify.success({
        title: "Walk details were copied from previous walk on " + templateDate,
        message: "Make any further changes here and save when you are done."
      });
    } else {
      this.logger.warn("copyDetailsFromPreviousWalk: no template to copy from");
    }
  }

  revertToPriorStatus() {
    this.logger.debug("revertToPriorWalkStatus:", this.status(), "->", this.priorStatus);
    if (this.priorStatus) {
      this.setStatus(this.priorStatus);
    }
  }

  unlinkRamblersDataFromCurrentWalk() {
    this.displayedWalk.walk.groupEvent.id = "";
    this.notify.progress({title: "Unlink walk", message: "Previous Ramblers walk has now been unlinked."});
  }

  unlinkOSMapsFromCurrentWalk() {
    this.linksService.deleteLink(this.displayedWalk.walk, LinkSource.OS_MAPS);
    this.notify.progress({title: "Unlink walk", message: "Previous OS Maps route has now been unlinked."});
  }

  canUnlinkRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.ramblersWalkExists();
  }

  canUnlinkOSMaps() {
    return !!this.linksService.linkWithSourceFrom(this.displayedWalk.walk.fields, LinkSource.OS_MAPS);
  }

  insufficientDataToUploadToRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.displayedWalk.walk
      && !(this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location) || this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
  }

  validateWalk(): WalkExport {
    return this.ramblersWalksAndEventsService.toWalkExport({localWalk: this.displayedWalk.walk, ramblersWalk: null});
  }

  swapStartAndEndLocations() {
    const startLocation = this.displayedWalk.walk.groupEvent.start_location;
    this.displayedWalk.walk.groupEvent.start_location = this.displayedWalk.walk.groupEvent.end_location;
    this.displayedWalk.walk.groupEvent.end_location = startLocation;
  }

  walkValidations() {
    const walkValidations = this.validateWalk().validationMessages;
    return "This walk cannot be included in the Ramblers Walks and Events Manager export due to the following "
      + walkValidations.length + " reasons(s): " + walkValidations.join(", ") + ".";
  }

  ramblersWalkExists() {
    return this.validateWalk().publishedOnRamblers;
  }

  loggedIn() {
    return this.memberLoginService.memberLoggedIn();
  }

  deleteWalkDetails() {
    this.confirmAction = ConfirmType.DELETE;
    this.notify.warning({
      title: "Confirm delete of walk details",
      message: "If you confirm this, the slot for " +
        this.displayDate.transform(this.displayedWalk.walk.groupEvent.start_date_time) + " will be deleted from the site."
    });
  }

  cancelWalkDetails() {
    this.confirmAction = ConfirmType.CANCEL;
    this.notify.warning({
      title: "Cancel changes",
      message: "Click Confirm to lose any changes you've just made for " +
        this.displayDate.transform(this.displayedWalk.walk.groupEvent.start_date_time) + ", or Cancel to carry on editing."
    });
  }

  confirmCancelWalkDetails() {
    this.closeEditView();
  }

  isWalkReadyForStatusChangeTo(eventType: WalkEventType): boolean {
    this.notify.hide();
    this.logger.info("isWalkReadyForStatusChangeTo ->", eventType);
    const walkValidations = this.validateWalk().validationMessages;
    if (eventType.mustHaveLeader && !this.displayedWalk.walk.fields.contactDetails.memberId) {
      this.notify.warning(
        {
          title: "Walk leader needed",
          message: "This walk cannot be changed to " + eventType.description + " yet."
        });
      this.logger.info("isWalkReadyForStatusChangeTo:false - this.displayedWalk.status ->", this.displayedWalk.status);
      return false;
    } else if (eventType.mustPassValidation && walkValidations.length > 0) {
      this.notify.warning(
        {
          title: "This walk is not ready to be " + eventType.readyToBe + " yet due to the following "
            + walkValidations.length + " reasons(s)",
          message: walkValidations.join(", ") +
            ". You can still save this walk, then come back later on to complete the rest of the details."
        });
      return false;
    } else {
      return true;
    }
  }

  createEventAndSendNotifications(): Promise<boolean> {
    this.saveInProgress = true;
    const sendNotificationsGivenWalkLeader: boolean = this.sendNotifications && !!this.displayedWalk.walk.fields.contactDetails.memberId;
    return this.walkNotificationService.createEventAndSendNotifications(this.notify, this.display.members, this.notificationDirective, this.displayedWalk, sendNotificationsGivenWalkLeader);
  }

  setStatus(status: EventType) {
    this.logger.info("setting status =>", status);
    this.displayedWalk.status = status;
    this.priorStatus = cloneDeep(this.displayedWalk.status);
    this.logger.info("setting status =>", status, "this.priorStatus", this.priorStatus);
  }

  async confirmDeleteWalkDetails() {
    this.setStatus(EventType.DELETED);
    try {
      return this.sendNotificationsSaveAndCloseIfNotSent();
    } catch (error) {
      return this.notifyError(error);
    }
  }

  private async sendNotificationsSaveAndCloseIfNotSent(): Promise<boolean> {
    const notificationSent: boolean = await this.createEventAndSendNotifications();
    return await this.saveAndCloseIfNotSent(notificationSent);
  }

  private async saveAndCloseIfNotSent(notificationSent: boolean): Promise<boolean> {
    this.logger.debug("saveAndCloseIfNotSent:saving walk:notificationSent", notificationSent);
    const savedWalk: ExtendedGroupEvent = await this.walksAndEventsService.createOrUpdate(this.displayedWalk.walk);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_SAVED, savedWalk));
    this.afterSaveWith(notificationSent);
    return notificationSent;
  }

  afterSaveWith(notificationSent: boolean): void {
    this.logger.debug("afterSaveWith:notificationSent", notificationSent);
    this.notify.clearBusy();
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    this.display.refreshDisplayedWalk(this.displayedWalk);
    if (!notificationSent) {
      this.closeEditView();
    }
  }


  closeEditView() {
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    this.display.closeEditView(this.displayedWalk.walk);
  }

  public async saveWalkDetails(): Promise<void> {
    Promise.resolve().then(async () => {
      this.notify.setBusy();
      this.saveInProgress = true;
      return this.updateGridReferenceIfRequired();
    })
      .then(async () => {
        if (MEETUP_API_AVAILABLE) {
          const walkNotification: WalkNotification = this.walkNotificationService.toWalkNotification(this.displayedWalk, this.display.members);
          const meetupDescription: string = await this.generateMeetupDescriptionHTML(walkNotification);
          return this.meetupService.synchroniseWalkWithEvent(this.notify, this.displayedWalk, meetupDescription);
        } else {
          return true;
        }
      })
      .then(() => this.sendNotificationsSaveAndCloseIfNotSent())
      .catch(error => this.notifyError(error));
  }

  public generateMeetupDescriptionHTML(walkNotification: WalkNotification): Promise<string> {
    const component: Type<MeetupDescriptionComponent> = MeetupDescriptionComponent;
    const componentAndData = new NotificationComponent<MeetupDescriptionComponent>(component);
    const viewContainerRef = this.notificationDirective.viewContainerRef;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.data = walkNotification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.info("notification html ->", html);
    return Promise.resolve(html);
  }

  private updateGridReferenceIfRequired() {
    this.logger.info("walk:", this.displayedWalk.walk);
    if (this.displayedWalk.walk?.groupEvent?.start_location?.postcode && (!this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location) || this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location).length < 14)) {
      return this.postcodeChange();
    } else {
      return Promise.resolve();
    }
  }

  private notifyError(error: any) {
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    const title = "Save of walk failed";
    this.logger.error(title, error);
    this.notify.error({continue: true, title, message: error});
  }

  confirmContactOther() {
  }

  requestApproval() {
    this.logger.debug("requestApproval called with current status:", this.status());
    if (this.isWalkReadyForStatusChangeTo(this.walksReferenceService.toWalkEventType(EventType.AWAITING_APPROVAL))) {
      this.confirmAction = ConfirmType.REQUEST_APPROVAL;
      this.notify.warning(this.confirmChangesMessage());
    }
  }

  contactOther() {
    this.notify.warning(this.confirmChangesMessage());
  }

  walkStatusChange() {
    this.notify.hide();
    this.logger.info("walkStatusChange - previous status:", this.displayedWalk.status);
    const eventType: WalkEventType = this.walksReferenceService.toWalkEventType(this.displayedWalk.status);
    if (this.isWalkReadyForStatusChangeTo(eventType)) {
      this.setStatus(eventType.eventType);
      switch (eventType.eventType) {
        case EventType.AWAITING_LEADER: {
          const walkDate = this.displayedWalk.walk.groupEvent.start_date_time;
          this.displayedWalk.walk = this.eventDefaultsService.createDefault({
            item_type: this.displayedWalk.walk.groupEvent.item_type,
            id: this.displayedWalk.walk.id,
            start_date_time: walkDate,
            events: this.displayedWalk.walk.events,
          });
          return this.notify.success({
            title: "Walk details reset for " + this.displayDate.transform(walkDate),
            message: "Status is now " + this.walksReferenceService.toWalkEventType(EventType.AWAITING_LEADER).description
          });
        }
        case EventType.APPROVED: {
          return this.approveWalkDetails();
        }
      }
    } else {
      setTimeout(() => {
        this.revertToPriorStatus();
      });
    }

  }

  walkStatuses(): WalkEventType[] {
    return this.walksReferenceService.walkStatuses();
  }

  approveWalkDetails() {
    const validationMessages = this.validateWalk().validationMessages;
    if (validationMessages.length > 0) {
      this.notify.warning({
        title: `This walk still has the following ${this.stringUtils.pluraliseWithCount(validationMessages.length, "area")} that ${this.stringUtils.pluralise(validationMessages.length, "needs", "need")} attention`,
        message: validationMessages.join(", ") + ". You'll have to get the rest of these details completed before you mark the walk as approved."
      });
    } else {
      this.notify.success({
        title: "Ready to publish walk details",
        message: "All fields appear to be filled in okay, so next time you save this walk it will be published."
      });
      this.setStatus(EventType.APPROVED);
    }
  }

  confirmRequestApproval() {
    this.setStatus(EventType.AWAITING_APPROVAL);
    this.saveWalkDetails();
  }

  cancelConfirmableAction() {
    this.confirmAction = ConfirmType.NONE;
    this.notify.hide();
  }

  editLongerDescription() {
    this.logger.debug("editLongerDescription");
    this.longerDescriptionPreview = false;
  }

  previewLongerDescription() {
    this.logger.debug("previewLongerDescription");
    this.longerDescriptionPreview = true;
  }

  copySelectedWalkLeader() {
    this.copySource = "copy-selected-walk-leader";
    this.populateWalkTemplates();
  }

  myOrWalkLeader() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ? "my" :
      this.displayedWalk.walk && this.displayedWalk.walk.fields.contactDetails.phone + "'s";
  }

  personToNotify() {
    const loggedInMemberIsLeadingWalk = this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk);
    this.logger.off("personToNotify:loggedInMemberIsLeadingWalk:", loggedInMemberIsLeadingWalk, "walkLeaderMemberId:", this.displayedWalk.walk.fields.contactDetails.memberId, "walk.fields.contactDetails.phone:", this.displayedWalk?.walk?.fields?.contactDetails?.displayName);
    return loggedInMemberIsLeadingWalk ?
      this.display.walksCoordinatorName() :
      this.displayedWalk?.walk?.fields?.contactDetails?.displayName;
  }

  populateWalkTemplates(injectedMemberId?: string) {
    const memberId = this.displayedWalk.walk.fields.contactDetails.memberId || injectedMemberId;
    let criteria: any;
    switch (this.copySource) {
      case "copy-selected-walk-leader": {
        criteria = {
          ["fields.contactDetails.memberId"]: this.copySourceFromWalkLeaderMemberId,
          ["groupEvent.title"]: {$exists: true}
        };
        break;
      }
      case "copy-with-os-maps-route-selected": {
        criteria = {osMapsRoute: {$exists: true}};
        break;
      }
      default: {
        criteria = {walkLeaderMemberId: memberId};
      }
    }
    this.logger.info("selecting walks", this.copySource, criteria);
    this.walksAndEventsService.all({criteria, sort: {walkDate: -1}})
      .then(walks => this.walksQueryService.activeWalks(walks))
      .then(walks => {
        this.logger.info("received walks", walks);
        this.copyFrom.walkTemplates = walks;
      });
  }

  onDateChange(date: DateValue) {
    if (date) {
      const startDateTime = this.dateUtils.isoDateTimeString(date.value);
      this.logger.info("onDateChange:date", date, "of type", typeof date, "setting start_date_time:", startDateTime);
      this.displayedWalk.walk.groupEvent.start_date_time = startDateTime;
    }
  }

  isExpandable(): boolean {
    return this.display.walkMode(this.displayedWalk.walk) === WalkViewMode.EDIT;
  }

  async postcodeChange() {
    if (this.displayedWalk?.walk?.groupEvent?.start_location?.postcode?.length > 3) {
      const postcode = this.displayedWalk.walk.groupEvent.start_location?.postcode;
      this.displayedWalk.walk.groupEvent.start_location.postcode = postcode?.toUpperCase()?.trim();
      const gridReferenceLookupResponse: GridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_6 = gridReferenceLookupResponse.gridReference6;
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_8 = gridReferenceLookupResponse.gridReference8;
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_10 = gridReferenceLookupResponse.gridReference10;
      this.pushWalkToChild();
      return this.updateGoogleMapsUrl();
    } else {
      return Promise.resolve();
    }
  }

  memberLookup(): DisplayMember[] {
    this.logger.off("memberLookup:showOnlyWalkLeaders:", this.showOnlyWalkLeaders);
    return this.showOnlyWalkLeaders ? this.previousWalkLeadersWithAliasOrMe() : this.membersWithAliasOrMe();
  }

  onStartDateTimeChange(startDateTime: string): void {
    this.logger.info("onStartDateTimeChange:startDateTime", this.displayedWalk.walk.groupEvent.start_date_time, "setting to startDateTime:", startDateTime);
    this.displayedWalk.walk.groupEvent.start_date_time = startDateTime;
    this.calculateAndSetFinishTime();
  }

  onEndDateTimeChange(endDateTime: string): void {
    this.logger.info("onEndDateTimeChange:endDateTime", this.displayedWalk.walk.groupEvent.end_date_time, "setting to endDateTime:", endDateTime);
    this.displayedWalk.walk.groupEvent.end_date_time = endDateTime;
  }

  calculateAndSetFinishTime() {
    if (this.displayedWalk.walk.fields.milesPerHour) {
      const endDateTime: string = this.ramblersWalksAndEventsService.walkFinishTime(this.displayedWalk.walk, this.displayedWalk.walk.fields.milesPerHour);
      this.logger.info("calculateAndSetFinishTime:endDateTime", endDateTime, "from:", this.displayedWalk.walk.groupEvent.end_date_time);
      this.displayedWalk.walk.groupEvent.end_date_time = endDateTime;
    } else {
      this.logger.info("calculateAndSetFinishTime:walk.fields.milesPerHour not set, not calculating finish time");
    }
  }

  calculateAndSetFinishTimeIfNotPopulated() {
    if (this.displayedWalk.walk.fields.milesPerHour && !this.displayedWalk.walk.groupEvent?.end_date_time) {
      const endDateTime = this.ramblersWalksAndEventsService.walkFinishTime(this.displayedWalk.walk, this.displayedWalk.walk.fields.milesPerHour);
      this.logger.info("calculateAndSetFinishTimeIfNotPopulated:endDateTime", endDateTime, "from:", this.displayedWalk.walk.groupEvent.end_date_time);
      this.displayedWalk.walk.groupEvent.end_date_time = endDateTime;
    } else {
      this.logger.info("calculateAndSetFinishTimeIfNotPopulated:not calculating finish time as walk.fields.milesPerHour:", this.displayedWalk.walk.fields.milesPerHour, "walk.groupEvent.end_date_time:", this.displayedWalk.walk.groupEvent?.end_date_time);
    }
  }

  onTabSelect(event: any): void {
    this.logger.info("onTabSelect:event", event);
    this.renderMapEdit = true;
  }

  walkTypeChange() {
    if ((this.displayedWalk.walk.groupEvent.shape === WalkType.LINEAR && !this.displayedWalk?.walk?.groupEvent?.end_location) || (this.displayedWalk.walk.groupEvent.shape === WalkType.LINEAR && this.displayedWalk?.walk?.groupEvent?.end_location?.postcode)) {
      this.displayedWalk.walk.groupEvent.end_location = cloneDeep(INITIALISED_LOCATION);
      this.logger.info("Created start location for linear walk type");
    }
  }

  difficultyChange() {
    this.logger.info("difficultyChange:", this.displayedWalk?.walk?.groupEvent?.difficulty);
  }

  difficultyComparer(item1: Difficulty, item2: Difficulty): boolean {
    return item1?.code === item2?.code;
  }

}
