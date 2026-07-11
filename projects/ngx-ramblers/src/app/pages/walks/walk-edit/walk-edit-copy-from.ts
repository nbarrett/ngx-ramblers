import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Subscription } from "rxjs";
import {
  CopyFrom,
  DisplayedWalk,
  EventField,
  EventType,
  ExtendedGroupEventWithLabel,
  GroupEventDateTimeField,
  GroupEventField,
  LinkSource,
  WalkCopyOption
} from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { DisplayMember } from "../../../models/member.model";
import { EventSource, ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { WalkDisplayService } from "../walk-display.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { GroupEventService } from "../../../services/walks-and-events/group-event.service";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { UIDateFormat } from "../../../models/date-format.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep } from "es-toolkit/compat";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { StringUtilsService } from "../../../services/string-utils.service";
import { EventDefaultsService } from "../../../services/event-defaults.service";
import { ExtendedFields, GroupEvent } from "../../../models/group-event.model";
import { FullNameWithAliasOrMePipe } from "../../../pipes/full-name-with-alias-or-me.pipe";
import { NgSelectComponent } from "@ng-select/ng-select";
import { WalkEditTab } from "../../../models/ui-actions";
import { isMongoId } from "../../../services/mongo-utils";

@Component({
  selector: "app-walk-edit-copy-from",
    imports: [
    FormsModule,
    NgSelectComponent
  ],
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
                    <div class="form-check form-check-inline align-items-start">
                      <input [id]="WalkCopyOption.COPY_SELECTED_WALK_LEADER"
                             type="radio"
                             class="form-check-input mt-2"
                             [disabled]="inputDisabled"
                             [(ngModel)]="copySource"
                             (change)="populateWalkTemplates()"
                             [value]="WalkCopyOption.COPY_SELECTED_WALK_LEADER"/>
                      <label class="form-check-label" [for]="WalkCopyOption.COPY_SELECTED_WALK_LEADER">Previously
                        led by ({{ previousWalkLeaderCount }}):</label>
                    </div>
                    <div class="form-check form-check-inline align-items-start mt-1">
                      <input [id]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED"
                             type="radio"
                             class="form-check-input mt-2"
                             [disabled]="inputDisabled"
                             [(ngModel)]="copySource"
                             (change)="populateWalkTemplates()"
                             [value]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED"/>
                      <label class="form-check-label" [for]="WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED">
                        With an OS Maps route I can follow</label>
                    </div>
                  </div>
                </div>
                @if (copySource === WalkCopyOption.COPY_SELECTED_WALK_LEADER) {
                  <div class="row mt-2">
                    <div class="col-sm-12">
                      <label for="copy-member-walks">Walk leader</label>
                      <ng-select id="copy-member-walks"
                                 [items]="previousWalkLeadersWithAliasOrMe"
                                 bindLabel="name"
                                 bindValue="memberId"
                                 [disabled]="inputDisabled"
                                 [searchable]="true"
                                 [clearable]="true"
                                 dropdownPosition="bottom"
                                 placeholder="(no walk leader selected)"
                                 [(ngModel)]="copySourceFromWalkLeaderMemberId"
                                 (ngModelChange)="copySelectedWalkLeader()">
                      </ng-select>
                    </div>
                  </div>
                }
                @if (copyFrom) {
                  <div class="row mt-2">
                    <div class="col-sm-12">
                      <label for="copy-walks-list">
                        Copy from {{
                          stringUtilsService.pluraliseWithCount(copyFrom?.walkTemplates?.length || 0, 'available walk')
                        }}:</label>
                      <ng-select id="copy-walks-list"
                                 [items]="walkTemplateOptions"
                                 bindLabel="ngSelectAttributes.label"
                                 [disabled]="inputDisabled"
                                 [searchable]="true"
                                 [clearable]="true"
                                 dropdownPosition="bottom"
                                 placeholder="Select a walk - type date, title or leader to filter"
                                 [(ngModel)]="selectedWalkTemplateOption"
                                 (ngModelChange)="copyDetailsFromPreviousWalk($event)">
                      </ng-select>
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
export class WalkEditCopyFromComponent implements OnInit, OnDestroy {

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
  @Output() tabRequest = new EventEmitter<WalkEditTab>();
  copySource = WalkCopyOption.COPY_SELECTED_WALK_LEADER;
  copySourceFromWalkLeaderMemberId = "";
  copyFrom: CopyFrom = {walkTemplate: {} as ExtendedGroupEvent, walkTemplates: []};
  previousWalkLeadersWithAliasOrMe: DisplayMember[] = [];
  previousWalkLeaderCount = 0;
  walkTemplateOptions: ExtendedGroupEventWithLabel[] = [];
  selectedWalkTemplateOption: ExtendedGroupEventWithLabel | null = null;
  private previousWalkLeaderIds: string[] = [];
  private leaderLabelMap: Map<string, string> = new Map();
  private subscriptions: Subscription[] = [];

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditCopyFromComponent", NgxLoggerLevel.ERROR);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  protected display = inject(WalkDisplayService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private walkEventService = inject(GroupEventService);
  private displayDate = inject(DisplayDatePipe);
  private dateUtils = inject(DateUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private eventDefaultsService = inject(EventDefaultsService);
  private fullNameWithAliasOrMePipe = inject(FullNameWithAliasOrMePipe);
  protected readonly WalkCopyOption = WalkCopyOption;

  async ngOnInit() {
    const allLeaderIds = (await this.walksAndEventsService.queryWalkLeaders()) || [];
    this.previousWalkLeaderIds = allLeaderIds.filter(id => isMongoId(id));
    this.leaderLabelMap = this.walksAndEventsService.leaderLabelMap();
    this.rebuildPreviousWalkLeaders();
    this.subscriptions.push(this.display.memberEvents().subscribe(() => this.rebuildPreviousWalkLeaders()));
    this.display.refreshCachedData();
    this.populateCopySourceFromWalkLeaderMemberId();
    await this.populateWalkTemplates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private rebuildPreviousWalkLeaders() {
    const memberIndex = new Map(this.display.members.map(member => [member.id, member]));
    this.previousWalkLeadersWithAliasOrMe = this.previousWalkLeaderIds.map(id => {
      const member = memberIndex.get(id);
      if (member) {
        return {
          memberId: member.id,
          name: this.fullNameWithAliasOrMePipe.transform(member),
          contactId: member.contactId,
          displayName: member.displayName,
          firstName: member.firstName,
          lastName: member.lastName,
          membershipNumber: member.membershipNumber
        };
      }
      const label = this.leaderLabelMap.get(id) || id;
      return {
        memberId: id,
        name: label,
        contactId: "",
        displayName: label,
        firstName: "",
        lastName: "",
        membershipNumber: ""
      };
    });
    this.previousWalkLeaderCount = this.previousWalkLeadersWithAliasOrMe.length;
  }

  async populateWalkTemplates(injectedMemberId?: string) {
    const memberId = this.displayedWalk.walk?.[EventField.CONTACT_DETAILS_MEMBER_ID] || injectedMemberId;
    let criteria: any;
    switch (this.copySource) {
      case WalkCopyOption.COPY_SELECTED_WALK_LEADER: {
        criteria = {
          [EventField.CONTACT_DETAILS_MEMBER_ID]: this.copySourceFromWalkLeaderMemberId,
          [GroupEventField.TITLE]: {$exists: true},
          [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK
        };
        break;
      }
      case WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED: {
        criteria = {
          [EventField.LINKS]: {
            $elemMatch: {
              source: LinkSource.OS_MAPS,
              href: {$nin: [null, ""]}
            }
          },
          [GroupEventField.TITLE]: {$exists: true},
          [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK
        };
        break;
      }
      default: {
        criteria = {
          [EventField.CONTACT_DETAILS_MEMBER_ID]: memberId,
          [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK
        };
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
        this.walkTemplateOptions = (events || []).map(event => ({
          ...event,
          ngSelectAttributes: {label: this.walkSummaryLabel(event)}
        }));
        this.selectedWalkTemplateOption = null;
      })
      .catch(error => {
        this.logger.error("Error fetching extended group events", error);
      });
  }

  copySelectedWalkLeader() {
    this.populateWalkTemplates();
  }

  private applyTimeOfDayToTargetDate(groupEvent: GroupEvent, field: GroupEventDateTimeField, targetDate: string) {
    const sourceDateTime = groupEvent[field];
    if (sourceDateTime && targetDate) {
      const timeOfDay = this.dateUtils.asDateTime(sourceDateTime).toFormat(UIDateFormat.RAMBLERS_TIME);
      groupEvent[field] = this.dateUtils.startTimeFrom(timeOfDay, this.dateUtils.asValueNoTime(targetDate));
    } else {
      delete groupEvent[field];
    }
  }

  private walkSummaryLabel(walk: ExtendedGroupEvent): string {
    const date = this.displayDate.transform(walk?.groupEvent?.start_date_time);
    const leader = walk?.fields?.contactDetails?.displayName || walk?.fields?.contactDetails?.phone || "unknown";
    const title = walk?.groupEvent?.title || "no description";
    return `${date} led by ${leader} (${title})`;
  }

  async copyDetailsFromPreviousWalk(selectedOption?: ExtendedGroupEventWithLabel | null) {
    try {
    this.logger.info("copyDetailsFromPreviousWalk:copySource:", this.copySource, "selectedOption:", selectedOption);
      const sourceTemplate: ExtendedGroupEvent | null = selectedOption
        ? this.copyFrom.walkTemplates?.find(template => template.id === selectedOption.id) || selectedOption
        : null;
      this.copyFrom.walkTemplate = sourceTemplate || ({} as ExtendedGroupEvent);
      const copyFromEvent: ExtendedGroupEvent = sourceTemplate ? cloneDeep(sourceTemplate) : null;
      if (!copyFromEvent) {
        this.logger.warn("copyDetailsFromPreviousWalk: no valid template to copy from");
        this.notify.warning({
          title: "No walk selected",
          message: "Please select a valid walk template to copy from."
        });
      } else {
        const templateDate = this.displayDate.transform(copyFromEvent.groupEvent.start_date_time);
        const targetDate = this.displayedWalk.walk?.groupEvent?.start_date_time;
        delete copyFromEvent.id;
        delete copyFromEvent.events;
        delete copyFromEvent.ramblersId;
        delete copyFromEvent.lastSyncedAt;
        delete copyFromEvent.syncedVersion;
        copyFromEvent.source = EventSource.LOCAL;
        delete copyFromEvent.groupEvent.id;
        delete copyFromEvent.groupEvent.url;
        delete copyFromEvent.groupEvent.external_url;
        delete copyFromEvent.groupEvent.status;
        delete copyFromEvent.groupEvent.cancellation_reason;
        delete copyFromEvent.groupEvent.linked_event;
        delete copyFromEvent.groupEvent.date_created;
        delete copyFromEvent.groupEvent.date_updated;
        this.applyTimeOfDayToTargetDate(copyFromEvent.groupEvent, GroupEventDateTimeField.START, targetDate);
        this.applyTimeOfDayToTargetDate(copyFromEvent.groupEvent, GroupEventDateTimeField.END, targetDate);
        this.applyTimeOfDayToTargetDate(copyFromEvent.groupEvent, GroupEventDateTimeField.MEETING, targetDate);
        delete copyFromEvent.fields.migratedFromId;
        copyFromEvent.fields.inputSource = InputSource.MANUALLY_CREATED;
        copyFromEvent.fields.links = (copyFromEvent.fields.links || []).filter(link => link.source !== LinkSource.RAMBLERS);
        copyFromEvent.fields.riskAssessment = [];
        copyFromEvent.fields.attendees = [];
        copyFromEvent.fields.notifications = [];
        const sourceFields = copyFromEvent.fields;
        const targetFields = this.displayedWalk.walk?.fields;
        const sourceGroupEvent = copyFromEvent.groupEvent;
        const targetGroupEvent = this.displayedWalk.walk?.groupEvent;
        const draftLeaderMemberId = targetFields?.contactDetails?.memberId ?? null;
        const fields = {
          ...targetFields,
          ...sourceFields,
          contactDetails: targetFields?.contactDetails,
          publishing: targetFields?.publishing
        };
        const groupEvent = {
          ...targetGroupEvent,
          ...sourceGroupEvent,
          walk_leader: targetGroupEvent?.walk_leader
        };
        this.rebuildLeaderIdentity(fields, groupEvent, draftLeaderMemberId);
        this.displayedWalk.walk = {
          ...this.displayedWalk.walk,
          groupEvent,
          fields
        };
        this.displayedWalk.walk.groupEvent.url = await this.walksAndEventsService.urlFor(this.displayedWalk.walk);
        this.logger.info("copyDetailsFromPreviousWalk:generated unique url:", this.displayedWalk.walk.groupEvent.url);

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
          message: "Review the copied details below and save when you are done."
        });
        this.tabRequest.emit(WalkEditTab.WALK_DETAILS);
      }
    } catch (error) {
      this.logger.error("copyDetailsFromPreviousWalk: error copying details", error);
      this.notify.error({
        title: "Failed to copy walk details",
        message: "An error occurred while copying the walk. Please try again."
      });
    }
  }

  private rebuildLeaderIdentity(fields: ExtendedFields, groupEvent: GroupEvent, memberId: string | null) {
    if (!memberId) {
      fields.contactDetails = this.eventDefaultsService.defaultContactDetails();
      fields.publishing = {
        meetup: {publish: false, contactName: null},
        ramblers: {publish: true, contactName: null}
      };
      groupEvent.walk_leader = null;
      return;
    }
    const leader = this.display.members.find(member => member.id === memberId);
    if (leader) {
      const contactId = leader.contactId ?? null;
      fields.contactDetails = {
        memberId: leader.id,
        contactId,
        displayName: leader.displayName ?? null,
        email: leader.email ?? null,
        phone: leader.mobileNumber ?? null
      };
      fields.publishing = {
        meetup: {publish: fields.publishing?.meetup?.publish ?? false, contactName: null},
        ramblers: {publish: fields.publishing?.ramblers?.publish ?? true, contactName: contactId}
      };
      groupEvent.walk_leader = this.eventDefaultsService.memberToContact(leader);
    }
  }

  private populateCopySourceFromWalkLeaderMemberId() {
    this.copySourceFromWalkLeaderMemberId = this.displayedWalk.walk?.fields?.contactDetails?.memberId
      || this.memberLoginService.loggedInMember().memberId;
  }
}
