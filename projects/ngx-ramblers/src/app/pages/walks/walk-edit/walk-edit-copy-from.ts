import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import {
  CopyFrom,
  DisplayedWalk,
  EventField,
  EventType,
  GroupEventField,
  LinkSource,
  WalkCopyOption
} from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkSummaryPipe } from "../../../pipes/walk-summary.pipe";
import { DisplayMember } from "../../../models/member.model";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { WalkDisplayService } from "../walk-display.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { GroupEventService } from "../../../services/walks-and-events/group-event.service";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep } from "lodash-es";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-walk-edit-copy-from",
  standalone: true,
  imports: [
    FormsModule,
    WalkSummaryPipe
  ],
  styles: `
    .input-led-by
      margin-left: 10px
      display: inline
      width: 350px
      height: 30px
      font-size: 1rem
      font-weight: 400
      line-height: 1.5
      color: #495057
      background-color: #fff
      background-clip: padding-box
      border: 1px solid #ced4da
      border-radius: 0.25rem
  `,
  template: `
    @if (display.allowEdits(displayedWalk?.walk) && displayedWalk?.walk?.fields?.contactDetails?.memberId) {
      <div class="img-thumbnail thumbnail-admin-edit">
        <div class="row">
          <div class="col-sm-12">
            <div class="img-thumbnail thumbnail-walk-edit">
              <div class="thumbnail-heading">Create {{ myOrWalkLeader }} walk based on an existing one
              </div>
              <ng-container>
                <div class="row">
                  <div class="col-sm-12">
                    <div class="custom-control custom-radio custom-control-inline">
                      <input [id]="WalkCopyOption.COPY_SELECTED_WALK_LEADER"
                             type="radio"
                             class="custom-control-input"
                             [(ngModel)]="copySource"
                             (change)="populateWalkTemplates()"
                             [value]="WalkCopyOption.COPY_SELECTED_WALK_LEADER"/>
                      <label class="custom-control-label" [for]="WalkCopyOption.COPY_SELECTED_WALK_LEADER">Previously
                        led
                        by:
                        <select
                          [disabled]="copySource!==WalkCopyOption.COPY_SELECTED_WALK_LEADER"
                          class="input-md input-led-by"
                          [(ngModel)]="copySourceFromWalkLeaderMemberId"
                          (ngModelChange)="copySelectedWalkLeader()"
                          id="copy-member-walks">
                          <option value="">(no walk leader selected)</option>
                          @for (member of previousWalkLeadersWithAliasOrMe; track member.memberId) {
                            <option
                              [ngValue]="member.memberId">{{ member.name }}
                            </option>
                          }
                        </select>
                      </label>
                    </div>
                    <div class="custom-control custom-radio custom-control-inline">
                      <input [id]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED"
                             type="radio"
                             class="custom-control-input"
                             [(ngModel)]="copySource"
                             (change)="populateWalkTemplates()"
                             [value]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED"/>
                      <label class="custom-control-label" [for]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED">
                        With an OS Maps route I can follow</label>
                    </div>
                  </div>
                </div>
                @if (copyFrom) {
                  <div class="row">
                    <div class="col-sm-12 mt-2">
                      <label for="copy-walks-list">
                        Copy from {{
                          stringUtilsService.pluraliseWithCount(copyFrom?.walkTemplates?.length || 0, 'available walk')
                        }}: </label>
                      <select [disabled]="inputDisabled" class="form-control input-sm"
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
  `
})
export class WalkEditCopyFromComponent {

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  get myOrWalkLeader(): string {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ? "my" :
      this.displayedWalk.walk?.fields?.contactDetails?.displayName + "'s";
  }
  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;

  @Input() notify!: AlertInstance;
  @Output() statusChange = new EventEmitter<EventType>();
  copySource = WalkCopyOption.COPY_SELECTED_WALK_LEADER;
  copySourceFromWalkLeaderMemberId = "";
  copyFrom: CopyFrom = {walkTemplate: {} as ExtendedGroupEvent, walkTemplates: []};
  previousWalkLeadersWithAliasOrMe: DisplayMember[] = [];

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditCopyFromComponent", NgxLoggerLevel.ERROR);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  protected display = inject(WalkDisplayService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private walkEventService = inject(GroupEventService);
  private displayDate = inject(DisplayDatePipe);
  private memberLoginService = inject(MemberLoginService);
  protected readonly WalkCopyOption = WalkCopyOption;

  async ngOnInit() {
    const previousWalkLeaderIds = await this.walksAndEventsService.queryWalkLeaders();
    this.previousWalkLeadersWithAliasOrMe = this.display.members
      .filter(member => previousWalkLeaderIds?.includes(member.id))
      .map(member => ({
        memberId: member.id,
        name: member.firstName + " " + member.lastName,
        contactId: member.contactId,
        displayName: member.displayName,
        firstName: member.firstName,
        lastName: member.lastName,
        membershipNumber: member.membershipNumber
      }));
    this.populateCopySourceFromWalkLeaderMemberId();
    await this.populateWalkTemplates();
  }

  async populateWalkTemplates(injectedMemberId?: string) {
    const memberId = this.displayedWalk.walk?.[EventField.CONTACT_DETAILS_MEMBER_ID] || injectedMemberId;
    let criteria: any;
    switch (this.copySource) {
      case WalkCopyOption.COPY_SELECTED_WALK_LEADER: {
        criteria = {
          [EventField.CONTACT_DETAILS_MEMBER_ID]: this.copySourceFromWalkLeaderMemberId,
          [GroupEventField.TITLE]: {$exists: true}
        };
        break;
      }
      case WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED: {
        criteria = {
          [EventField.LINKS]: {
            $elemMatch: {source: LinkSource.OS_MAPS}
          }
        };
        break;
      }
      default: {
        criteria = {[EventField.CONTACT_DETAILS_MEMBER_ID]: memberId};
      }
    }
    this.logger.info("selecting extended group events", this.copySource, criteria);
    this.walksAndEventsService.all({
      inputSource: InputSource.MANUALLY_CREATED,
      suppressEventLinking: true,
      dataQueryOptions: {
        criteria,
        sort: {[GroupEventField.START_DATE]: -1}
      }
    })
      .then(events => this.extendedGroupEventQueryService.activeEvents(events))
      .then(events => {
        this.logger.info("received extended group events", events);
        this.copyFrom.walkTemplates = events;
      })
      .catch(error => {
        this.logger.error("Error fetching extended group events", error);
      });
  }

  copySelectedWalkLeader() {
    this.populateWalkTemplates();
  }

  async copyDetailsFromPreviousWalk() {
    try {
    this.logger.info("copyDetailsFromPreviousWalk:copySource:", this.copySource, "copyFrom:", this.copyFrom);
      const copyFromEvent: ExtendedGroupEvent = cloneDeep(this.copyFrom.walkTemplate);
      if (!copyFromEvent) {
        this.logger.warn("copyDetailsFromPreviousWalk: no valid template to copy from");
        this.notify.warning({
          title: "No walk selected",
          message: "Please select a valid walk template to copy from."
        });
      } else {
        const templateDate = this.displayDate.transform(copyFromEvent.groupEvent.start_date_time);
        delete copyFromEvent.id;
        delete copyFromEvent.events;
        delete copyFromEvent.groupEvent.start_date_time;
        delete copyFromEvent.groupEvent.external_url;
        delete copyFromEvent.groupEvent.end_date_time;
        delete copyFromEvent.fields.migratedFromId;
        delete copyFromEvent.fields.contactDetails;
        copyFromEvent.fields.links = [];
        copyFromEvent.fields.riskAssessment = [];
        copyFromEvent.groupEvent.url = await this.walksAndEventsService.urlFromTitle(copyFromEvent.groupEvent.title);
        const sourceFields = copyFromEvent.fields;
        const targetFields = this.displayedWalk.walk?.fields;
        const sourceGroupEvent = copyFromEvent.groupEvent;
        const targetGroupEvent = this.displayedWalk.walk?.groupEvent;
        const fields = {
          ...targetFields,
          ...sourceFields
        };
        const groupEvent = {
          ...targetGroupEvent,
          ...sourceGroupEvent
        };
        this.displayedWalk.walk = {
          ...this.displayedWalk.walk,
          groupEvent,
          fields
        };

        this.logger.info("copyDetailsFromPreviousWalk:Walk is now:", this.displayedWalk.walk);
        this.logger.info("copyDetailsFromPreviousWalk:start_date_time:", this.displayedWalk.walk.groupEvent.start_date_time);
        this.logger.info("copyDetailsFromPreviousWalk:end_date_time:", this.displayedWalk.walk.groupEvent.end_date_time);
        const event = this.walkEventService.createEventIfRequired(
          this.displayedWalk.walk,
          EventType.WALK_DETAILS_COPIED,
          `Copied from previous walk on ${templateDate}`
        );
        this.statusChange.emit(EventType.AWAITING_WALK_DETAILS);
        this.walkEventService.writeEventIfRequired(this.displayedWalk.walk, event);
        this.notify.success({
          title: `Walk details copied from ${templateDate}`,
          message: "Make any further changes here and save when you are done."
        });
      }
    } catch (error) {
      this.logger.error("copyDetailsFromPreviousWalk: error copying details", error);
      this.notify.error({
        title: "Failed to copy walk details",
        message: "An error occurred while copying the walk. Please try again."
      });
    }
  }

  private populateCopySourceFromWalkLeaderMemberId() {
    this.copySourceFromWalkLeaderMemberId = this.displayedWalk.walk?.fields?.contactDetails?.memberId
      || this.memberLoginService.loggedInMember().memberId;
  }
}
