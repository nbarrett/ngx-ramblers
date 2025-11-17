import { inject, Injectable } from "@angular/core";
import { cloneDeep, isEmpty } from "es-toolkit/compat";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { FilterCriteria, SortOrder } from "../../models/api-request.model";
import { CommitteeMember, RoleType } from "../../models/committee.model";
import { Member, MemberFilterSelection } from "../../models/member.model";
import { EventsData, SocialEventsPermissions } from "../../models/social-events.model";
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
import { PageService } from "../../services/page.service";
import { ExtendedGroupEvent, HasStartAndEndTime } from "../../models/group-event.model";
import { StringUtilsService } from "../../services/string-utils.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { EventDatesAndTimesPipe } from "../../pipes/event-times-and-dates.pipe";
import { EM_DASH_WITH_SPACES } from "../../models/content-text.model";
import { DateUtilsService } from "../../services/date-utils.service";

const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

@Injectable({
  providedIn: "root"
})

export class SocialDisplayService {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialDisplayService", NgxLoggerLevel.ERROR);
  private pageService = inject(PageService);
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
  public allow: SocialEventsPermissions = {};
  public confirm: Confirm = new Confirm();
  public memberFilterSelections: MemberFilterSelection[];
  private group: Organisation;
  relatedLinksMediaWidth: 22;

  constructor() {
    this.configureEventSubscriptions();
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
    return filterCriteria.map(item => ({key: item, value: this.socialEventsTitle(item, hasStartAndEndTime)}));
  }

  sortOrderOptions(): KeyValue<string>[] {
    return enumKeyValues(SortOrder).map(item => ({key: item.key, value: this.stringUtils.asTitle(item.value)}));
  }

  inNewEventMode(): boolean {
    return this.allow.edits && this.urlService.lastPathSegment() === "new";
  }

  applyAllows() {
    const detailViewAllowed = this.group?.socialDetailsPublic;
    this.allow.detailView = detailViewAllowed;
    this.allow.summaryView = this.memberLoginService.allowSocialAdminEdits() || !detailViewAllowed;
    this.allow.edits = this.memberLoginService.allowSocialAdminEdits() && this.socialPopulationLocal();
    this.allow.copy = this.memberLoginService.allowSocialAdminEdits() && this.socialPopulationLocal();
    this.allow.contentEdits = this.siteEditService.active() && this.memberLoginService.allowContentEdits();
    this.allow.admin = this.memberLoginService.allowSocialAdminEdits();
    this.allow.delete = this.memberLoginService.allowSocialAdminEdits();
    this.logger.info("permissions:", this.allow);
  }

  private authChanges() {
    if (this.memberLoginService.memberLoggedIn()) {
      this.refreshSocialMemberFilterSelection()
        .then(members => {
          this.memberFilterSelections = members;
        });
    }
  }

  attachmentExists(socialEvent: ExtendedGroupEvent): boolean {
    return !isEmpty(socialEvent?.fields?.attachment);
  }

  committeeMembersPlusOrganiser(socialEvent: ExtendedGroupEvent, members: Member[]): CommitteeMember[] {
    const committeeMembers = socialEvent?.fields?.contactDetails?.memberId ?
      [this.committeeMemberFromSocialEvent(socialEvent, members)].concat(this.committeeReferenceData?.committeeMembers()) : this.committeeReferenceData?.committeeMembers();
    this.logger.debug("committeeMembersPlusOrganiser:", committeeMembers);
    return committeeMembers;
  }

  committeeMembers(): CommitteeMember[] {
    return this.committeeReferenceData?.committeeMembers();
  }

  committeeMemberFromSocialEvent(socialEvent: ExtendedGroupEvent, members: Member[]): CommitteeMember {
    const fullName = this.memberIdToFullNamePipe.transform(socialEvent?.fields?.contactDetails?.memberId, members);
    return {
      type: "organiser",
      fullName,
      memberId: socialEvent?.fields?.contactDetails?.memberId,
      description: "Organiser",
      nameAndDescription: `Organiser (${fullName})`,
      email: socialEvent?.fields?.contactDetails?.email,
      roleType: RoleType.GROUP_MEMBER
    };
  }

  attachmentTitle(socialEvent: ExtendedGroupEvent) {
    return socialEvent?.fields?.attachment ? (socialEvent.fields.attachment.title || `Attachment: ${socialEvent.fields.attachment.originalFileName}`) : "";
  }

  groupEventLink(extendedGroupEvent: ExtendedGroupEvent, relative: boolean): string {
    const eventId: string = this.stringUtils.lastItemFrom(extendedGroupEvent?.groupEvent?.url) || this.stringUtils.kebabCase(extendedGroupEvent?.groupEvent?.title) || extendedGroupEvent?.groupEvent?.id || extendedGroupEvent?.id;
    const url = eventId ? this.urlService.linkUrl({
      area: extendedGroupEvent.groupEvent.item_type === RamblersEventType.GROUP_EVENT ? this.pageService.socialPage()?.href : this.pageService.walksPage()?.href,
      id: eventId,
      relative
    }) : null;
    this.logger.off("groupEventLink:extendedGroupEvent:", extendedGroupEvent, "url:", url);
    return url;
  }

  attachmentUrl(socialEvent: ExtendedGroupEvent) {
    return socialEvent?.fields?.attachment ? `${this.urlService.baseUrl()}/${this.attachmentBaseUrl}/${socialEvent.fields.attachment.awsFileName}` : "";
  }

  attendeeList(socialEvent: ExtendedGroupEvent, members: MemberFilterSelection[]) {
    return socialEvent?.fields?.attendees?.map(memberId => members.find(member => member.id === memberId.id))
      ?.sort(sortBy("text")).map(item => item?.text).join(", ");
  }

  socialEventsTitle(filterType: FilterCriteria, hasStartAndEndTime: HasStartAndEndTime) {
    this.logger.off("socialEventsTitle:", filterType);
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
      memberGrouping: disabled ? "no email address" : `Social Member`,
      member,
      memberInformation: this.fullNameWithAlias.transform(member),
      disabled
    };
  }

  refreshSocialMemberFilterSelection(): Promise<MemberFilterSelection[]> {
    return this.memberService.publicFields(this.memberService.filterFor.SOCIAL_MEMBERS).then(members => {
      this.logger.debug("refreshMembers -> populated ->", members.length, "members");
      return members.map((member => this.toMemberFilterSelection(member)))
        .sort(SORT_BY_NAME);
    });
  }

  public socialPopulationLocal(): boolean {
    const result = this.group?.socialEventPopulation === EventPopulation.LOCAL;
    this.logger.debug("walkPopulationWalksManager:walkPopulation:", this.group?.socialEventPopulation, "result:", result);
    return result;
  }

}
