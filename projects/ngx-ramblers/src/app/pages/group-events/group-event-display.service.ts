import { inject, Injectable } from "@angular/core";
import { cloneDeep, isEmpty } from "es-toolkit/compat";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { FilterCriteria, SortOrder } from "../../models/api-request.model";
import { CommitteeMember, RoleType } from "../../models/committee.model";
import { Member, MemberFilterSelection } from "../../models/member.model";
import { EventsData, GroupEventsPermissions } from "../../models/group-events.model";
import { Confirm } from "../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { sortBy } from "../../functions/arrays";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { enumKeyValues, KeyValue } from "../../functions/enums";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { UrlService } from "../../services/url.service";
import { SiteEditService } from "../../site-edit/site-edit.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../../services/system/system-config.service";
import { ExtendedGroupEvent, HasStartAndEndTime } from "../../models/group-event.model";
import { StringUtilsService } from "../../services/string-utils.service";
import { EventDatesAndTimesPipe } from "../../pipes/event-times-and-dates.pipe";
import { EM_DASH_WITH_SPACES, PathSegment } from "../../models/content-text.model";
import { DateUtilsService } from "../../services/date-utils.service";

const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

@Injectable({
  providedIn: "root"
})

export class GroupEventDisplayService {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventDisplayService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private authService = inject(AuthService);
  private memberService = inject(MemberService);
  private siteEditService = inject(SiteEditService);
  private memberLoginService = inject(MemberLoginService);
  private urlService = inject(UrlService);
  private dateUtilsService = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private fullNameWithAlias = inject(FullNameWithAliasPipe);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private committeeConfigService = inject(CommitteeConfigService);
  private contentMetadataService = inject(ContentMetadataService);
  private eventDatesAndTimesPipe = inject(EventDatesAndTimesPipe);
  public attachmentBaseUrl = this.contentMetadataService.baseUrl("socialEvents");
  private committeeReferenceData: CommitteeReferenceData;
  public allow: GroupEventsPermissions = {};
  public confirm: Confirm = new Confirm();
  public memberFilterSelections: MemberFilterSelection[];
  private group: Organisation;
  relatedLinksMediaWidth: 22;

  constructor() {
    this.configureEventSubscriptions();
  }

  groupEventArea(): string {
    return this.urlService.area();
  }

  public fromAndToFrom(eventsData: EventsData): HasStartAndEndTime {
    const hasStartAndEnd = {
      start_date_time: this.dateUtilsService.isoDateTime(eventsData?.fromDate),
      end_date_time: this.dateUtilsService.isoDateTime(eventsData?.toDate)
    };
    this.logger.info("fromAndToFrom:eventsData;", eventsData, "fromAndToFrom:", hasStartAndEnd);
    return hasStartAndEnd;
  }

  private configureEventSubscriptions() {
    this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.applyAllows();
    });
    this.authService.authResponse().subscribe(() => {
      this.applyAllows();
      this.authChanges();
    });
    this.siteEditService.events.subscribe(() => this.applyAllows());
    this.applyAllows();
    this.authChanges();
  }


  loggedIn(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  filterCriteriaOptionsFor(filterCriteria: FilterCriteria[], hasStartAndEndTime?: HasStartAndEndTime): KeyValue<string>[] {
    return filterCriteria.map(item => ({key: item, value: this.groupEventsTitle(item, hasStartAndEndTime)}));
  }

  sortOrderOptions(selectedSortOrder?: SortOrder): KeyValue<string>[] {
    const options = enumKeyValues(SortOrder).map(item => ({key: item.key, value: this.stringUtils.asTitle(item.value)}));
    if (selectedSortOrder) {
      const selectedIndex = options.findIndex(item => item.key === selectedSortOrder);
      if (selectedIndex > 0) {
        const [selected] = options.splice(selectedIndex, 1);
        options.unshift(selected);
      }
    }
    return options;
  }

  inNewEventMode(): boolean {
    return this.allow.edits && this.urlService.lastPathSegment() === PathSegment.NEW;
  }

  applyAllows() {
    const detailViewAllowed = this.group?.socialDetailsPublic;
    this.allow.detailView = detailViewAllowed;
    this.allow.summaryView = this.memberLoginService.allowSocialAdminEdits() || !detailViewAllowed;
    this.allow.edits = this.memberLoginService.allowSocialAdminEdits();
    this.allow.copy = this.memberLoginService.allowSocialAdminEdits();
    this.allow.contentEdits = this.siteEditService.active() && this.memberLoginService.allowContentEdits();
    this.allow.admin = this.memberLoginService.allowSocialAdminEdits();
    this.allow.delete = this.memberLoginService.allowSocialAdminEdits();
    this.logger.info("permissions:", this.allow);
  }

  private authChanges() {
    if (this.memberLoginService.memberLoggedIn()) {
      this.refreshGroupMemberFilterSelection()
        .then(members => {
          this.memberFilterSelections = members;
        });
    }
  }

  attachmentExists(groupEvent: ExtendedGroupEvent): boolean {
    return !isEmpty(groupEvent?.fields?.attachment);
  }

  committeeMembersPlusOrganiser(groupEvent: ExtendedGroupEvent, members: Member[]): CommitteeMember[] {
    const committeeMembers = groupEvent?.fields?.contactDetails?.memberId ?
      [this.committeeMemberFromGroupEvent(groupEvent, members)].concat(this.committeeReferenceData?.committeeMembers()) : this.committeeReferenceData?.committeeMembers();
    this.logger.debug("committeeMembersPlusOrganiser:", committeeMembers);
    return committeeMembers;
  }

  committeeMembers(): CommitteeMember[] {
    return this.committeeReferenceData?.committeeMembers();
  }

  committeeMemberFromGroupEvent(groupEvent: ExtendedGroupEvent, members: Member[]): CommitteeMember {
    const fullName = this.memberIdToFullNamePipe.transform(groupEvent?.fields?.contactDetails?.memberId, members);
    return {
      type: "organiser",
      fullName,
      memberId: groupEvent?.fields?.contactDetails?.memberId,
      description: "Organiser",
      nameAndDescription: `Organiser (${fullName})`,
      email: groupEvent?.fields?.contactDetails?.email,
      roleType: RoleType.GROUP_MEMBER
    };
  }

  attachmentTitle(groupEvent: ExtendedGroupEvent) {
    return groupEvent?.fields?.attachment ? (groupEvent.fields.attachment.title || `Attachment: ${groupEvent.fields.attachment.originalFileName}`) : "";
  }

  groupEventLink(extendedGroupEvent: ExtendedGroupEvent, relative: boolean): string {
    const eventId: string = this.stringUtils.lastItemFrom(extendedGroupEvent?.groupEvent?.url) || this.stringUtils.kebabCase(extendedGroupEvent?.groupEvent?.title) || extendedGroupEvent?.groupEvent?.id || extendedGroupEvent?.id;
    const segments = this.urlService.pathSegments();
    const last = segments[segments.length - 1];
    const areaSegments = last === PathSegment.EDIT ? segments.slice(0, -2) : (last === PathSegment.NEW || last === eventId ? segments.slice(0, -1) : segments);
    const area = areaSegments.join("/");
    const url = eventId ? this.urlService.linkUrl({
      area,
      id: eventId,
      relative
    }) : null;
    this.logger.off("groupEventLink:extendedGroupEvent:", extendedGroupEvent, "area:", area, "url:", url);
    return url;
  }

  attachmentUrl(groupEvent: ExtendedGroupEvent) {
    return groupEvent?.fields?.attachment ? `${this.urlService.baseUrl()}/${this.attachmentBaseUrl}/${groupEvent.fields.attachment.awsFileName}` : "";
  }

  attendeeList(groupEvent: ExtendedGroupEvent, members: MemberFilterSelection[]) {
    return groupEvent?.fields?.attendees?.map(memberId => members.find(member => member.id === memberId.id))
      ?.sort(sortBy("text")).map(item => item?.text).join(", ");
  }

  groupEventsTitle(filterType: FilterCriteria, hasStartAndEndTime: HasStartAndEndTime) {
    this.logger.off("groupEventsTitle:", filterType);
    if (filterType === FilterCriteria.DATE_RANGE && hasStartAndEndTime) {
      return `Events${EM_DASH_WITH_SPACES}${this.eventDatesAndTimesPipe.transform(hasStartAndEndTime, {noTimes: true})}`;
    } else {
      return this.stringUtils.asTitle(filterType);
    }
  }

  createModalOptions(initialState?: any): ModalOptions {
    return {
      class: "modal-xl",
      animated: false,
      backdrop: "static",
      ignoreBackdropClick: false,
      keyboard: true,
      focus: true,
      show: true,
      initialState: cloneDeep(initialState)
    };
  }

  toMemberFilterSelection(member: Member): MemberFilterSelection {
    const disabled = !member.email;
    return {
      id: member.id,
      order: 0,
      memberGrouping: disabled ? "no email address" : `Group Member`,
      member,
      memberInformation: this.fullNameWithAlias.transform(member),
      disabled
    };
  }

  refreshGroupMemberFilterSelection(): Promise<MemberFilterSelection[]> {
    return this.memberService.publicFields(this.memberService.filterFor.SOCIAL_MEMBERS).then(members => {
      this.logger.debug("refreshMembers -> populated ->", members.length, "members");
      return members.map((member => this.toMemberFilterSelection(member)))
        .sort(SORT_BY_NAME);
    });
  }

  public groupEventPopulationLocal(): boolean {
    const result = this.group?.socialEventPopulation === EventPopulation.LOCAL;
    this.logger.debug("walkPopulationWalksManager:walkPopulation:", this.group?.socialEventPopulation, "result:", result);
    return result;
  }

  public showSocialOnRamblersLink(): boolean {
    return this.group?.showSocialOnRamblersLink !== false;
  }

  public showSocialRelatedLinks(): boolean {
    return this.group?.showSocialRelatedLinks !== false;
  }

}
