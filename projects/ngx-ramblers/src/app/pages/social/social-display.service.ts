import { inject, Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import isEmpty from "lodash-es/isEmpty";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { DateCriteria } from "../../models/api-request.model";
import { CommitteeMember, RoleType } from "../../models/committee.model";
import { Member, MemberFilterSelection } from "../../models/member.model";
import { SocialEventsPermissions } from "../../models/social-events.model";
import { Confirm } from "../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { sortBy } from "../../functions/arrays";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { enumValues, KeyValue } from "../../functions/enums";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { UrlService } from "../../services/url.service";
import { SiteEditService } from "../../site-edit/site-edit.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../../services/system/system-config.service";
import { PageService } from "../../services/page.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";

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
  private fullNameWithAlias = inject(FullNameWithAliasPipe);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private committeeConfigService = inject(CommitteeConfigService);
  private contentMetadataService = inject(ContentMetadataService);
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

  private configureEventSubscriptions() {
    this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.applyAllows();
    });
    this.authService.authResponse().subscribe(() => this.applyAllows());
    this.authService.authResponse().subscribe(() => this.authChanges());
    this.siteEditService.events.subscribe(() => this.applyAllows());
    this.applyAllows();
    this.authChanges();
  }


  loggedIn(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  dateSelectionOptions(): KeyValue<string>[] {
    return enumValues(DateCriteria).map(item => ({key: item, value: this.socialEventsTitle(item)}));
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
    this.logger.debug("permissions:", this.allow);
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

  socialEventLink(socialEvent: ExtendedGroupEvent, relative: boolean) {
    const eventId: string = socialEvent?.id || socialEvent?.groupEvent?.id;
    return eventId ? this.urlService.linkUrl({
      area: this.pageService.socialPage()?.href,
      id: eventId,
      relative
    }) : null;
  }

  attachmentUrl(socialEvent: ExtendedGroupEvent) {
    return socialEvent?.fields?.attachment ? `${this.urlService.baseUrl()}/${this.attachmentBaseUrl}/${socialEvent.fields.attachment.awsFileName}` : "";
  }

  attendeeList(socialEvent: ExtendedGroupEvent, members: MemberFilterSelection[]) {
    return socialEvent?.fields?.attendees?.map(memberId => members.find(member => member.id === memberId.id))
      ?.sort(sortBy("text")).map(item => item?.text).join(", ");
  }

  socialEventsTitle(filterType: number) {
    this.logger.info("socialEventsTitle:", filterType);
    switch (Number(filterType)) {
      case DateCriteria.CURRENT_OR_FUTURE_DATES:
        return "Future Social Events";
      case DateCriteria.PAST_DATES:
        return "Past Social Events";
      case DateCriteria.ALL_DATES:
        return "All Social Events";
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
