import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { DisplayedWalk, EventField, EventType, GroupEventField } from "../../../models/walk.model";
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
                      <input id="copy-selected-walk-leader"
                             type="radio"
                             class="custom-control-input"
                             [(ngModel)]="copySource"
                             (change)="populateWalkTemplates()"
                             value="copy-selected-walk-leader"/>
                      <label class="custom-control-label" for="copy-selected-walk-leader">Previously
                        led
                        by:
                        <select
                          [disabled]="copySource!=='copy-selected-walk-leader'"
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
                        Copy from {{ copyFrom?.walkTemplates?.length || 0 }} available
                        walk(s): </label>
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
  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  @Input() notify!: AlertInstance;
  @Output() statusChange = new EventEmitter<EventType>();
  copySource = "copy-selected-walk-leader";
  copySourceFromWalkLeaderMemberId = "";
  copyFrom: {
    walkTemplate: ExtendedGroupEvent,
    walkTemplates: ExtendedGroupEvent[]
  } = {walkTemplate: {} as ExtendedGroupEvent, walkTemplates: []};
  previousWalkLeadersWithAliasOrMe: DisplayMember[] = [];

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditCopyFromComponent", NgxLoggerLevel.ERROR);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  protected display = inject(WalkDisplayService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private walkEventService = inject(GroupEventService);
  private displayDate = inject(DisplayDatePipe);
  private memberLoginService = inject(MemberLoginService);

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

  get myOrWalkLeader(): string {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ? "my" :
      this.displayedWalk.walk?.fields?.contactDetails?.displayName + "'s";
  }

  async populateWalkTemplates(injectedMemberId?: string) {
    const memberId = this.displayedWalk.walk?.fields?.contactDetails?.memberId || injectedMemberId;
    let criteria: any;
    switch (this.copySource) {
      case "copy-selected-walk-leader": {
        criteria = {
          [EventField.CONTACT_DETAILS_MEMBER_ID]: this.copySourceFromWalkLeaderMemberId,
          [GroupEventField.TITLE]: {$exists: true}
        };
        break;
      }
      case "copy-with-os-maps-route-selected": {
        // TODO: these are broken
        criteria = {osMapsRoute: {$exists: true}};
        break;
      }
      default: {
        // TODO: these are broken
        criteria = {walkLeaderMemberId: memberId};
      }
    }
    this.logger.info("selecting walks", this.copySource, criteria);
    this.walksAndEventsService.all({
      inputSource: InputSource.MANUALLY_CREATED,
      suppressEventLinking: true,
      dataQueryOptions: {criteria, sort: {[GroupEventField.START_DATE]: -1}}
    })
      .then(walks => this.extendedGroupEventQueryService.activeEvents(walks))
      .then(walks => {
        this.logger.info("received walks", walks);
        this.copyFrom.walkTemplates = walks;
      });
  }


  copySelectedWalkLeader() {
    this.populateWalkTemplates();
  }

  async copyDetailsFromPreviousWalk() {
    this.logger.info("copyDetailsFromPreviousWalk:copySource:", this.copySource, "copyFrom:", this.copyFrom);
    const copyFromEvent = cloneDeep(this.copyFrom.walkTemplate) as ExtendedGroupEvent;
    if (copyFromEvent) {
      const templateDate = this.displayDate.transform(copyFromEvent.groupEvent.start_date_time);
      delete copyFromEvent.id;
      delete copyFromEvent.events;
      delete copyFromEvent.groupEvent.start_date_time;
      delete copyFromEvent.groupEvent.end_date_time;
      delete copyFromEvent.groupEvent.url;
      delete copyFromEvent.groupEvent.external_url;
      delete copyFromEvent.fields.contactDetails;
      copyFromEvent.fields.links = [];
      copyFromEvent.fields.riskAssessment = [];
      copyFromEvent.groupEvent.url = await this.walksAndEventsService.urlFromTitle(copyFromEvent.groupEvent.title);
      this.logger.info("copyDetailsFromPreviousWalk:Applying copyFromEvent:", copyFromEvent, "to:", cloneDeep(this.displayedWalk.walk));
      const sourceFields = copyFromEvent.fields || {};
      this.displayedWalk.walk = {
        ...this.displayedWalk.walk,
        ...copyFromEvent,
        fields: {
          ...this.displayedWalk?.walk?.fields,
          ...Object.keys(sourceFields).reduce((acc, key) => {
            acc[key] = sourceFields[key];
            return acc;
          }, {} as typeof sourceFields)
        }
      };
      this.logger.info("copyDetailsFromPreviousWalk:Walk is now:", this.displayedWalk.walk);
      const event = this.walkEventService.createEventIfRequired(this.displayedWalk.walk,
        EventType.WALK_DETAILS_COPIED, "Copied from previous walk on " + templateDate);
      this.statusChange.emit(EventType.AWAITING_WALK_DETAILS);
      this.walkEventService.writeEventIfRequired(this.displayedWalk.walk, event);
      this.notify.success({
        title: "Walk details were copied from previous walk on " + templateDate,
        message: "Make any further changes here and save when you are done."
      });
    } else {
      this.logger.warn("copyDetailsFromPreviousWalk: no template to copy from");
    }
  }

  private populateCopySourceFromWalkLeaderMemberId() {
    this.copySourceFromWalkLeaderMemberId = this.displayedWalk.walk?.fields?.contactDetails?.memberId
      || this.memberLoginService.loggedInMember().memberId;
  }
}
