import { Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import isEmpty from "lodash-es/isEmpty";
import { ModalOptions } from "ngx-bootstrap/modal";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { DateCriteria } from "../../models/api-request.model";
import { CommitteeMember, RoleType } from "../../models/committee.model";
import { Member, MemberFilterSelection } from "../../models/member.model";
import { SocialEvent, SocialEventsPermissions } from "../../models/social-events.model";
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

const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

@Injectable({
  providedIn: "root"
})

export class SocialDisplayService {
  private logger: Logger;
  public attachmentBaseUrl = this.contentMetadataService.baseUrl("socialEvents");
  private committeeReferenceData: CommitteeReferenceData;
  public allow: SocialEventsPermissions = {};
  public confirm: Confirm = new Confirm();
  public memberFilterSelections: MemberFilterSelection[];
  private group: Organisation;
  relatedLinksMediaWidth: 22;

  constructor(
    private pageService: PageService,
    private systemConfigService: SystemConfigService,
    private authService: AuthService,
    private memberService: MemberService,
    private siteEditService: SiteEditService,
    private memberLoginService: MemberLoginService,
    private urlService: UrlService,
    private fullNameWithAlias: FullNameWithAliasPipe,
    private memberIdToFullNamePipe: MemberIdToFullNamePipe,
    private committeeConfigService: CommitteeConfigService,
    private contentMetadataService: ContentMetadataService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialDisplayService, NgxLoggerLevel.OFF);
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

  attachmentExists(socialEvent: SocialEvent): boolean {
    return !isEmpty(socialEvent?.attachment);
  }

  committeeMembersPlusOrganiser(socialEvent: SocialEvent, members: Member[]): CommitteeMember[] {
    const committeeMembers = socialEvent.eventContactMemberId ?
      [this.committeeMemberFromSocialEvent(socialEvent, members)].concat(this.committeeReferenceData?.committeeMembers()) : this.committeeReferenceData?.committeeMembers();
    this.logger.debug("committeeMembersPlusOrganiser:", committeeMembers);
    return committeeMembers;
  }

  committeeMembers(): CommitteeMember[] {
    return this.committeeReferenceData?.committeeMembers();
  }

  committeeMemberFromSocialEvent(socialEvent: SocialEvent, members: Member[]): CommitteeMember {
    const fullName = this.memberIdToFullNamePipe.transform(socialEvent.eventContactMemberId, members);
    return {
      type: "organiser",
      fullName,
      memberId: socialEvent.eventContactMemberId,
      description: "Organiser",
      nameAndDescription: `Organiser (${fullName})`,
      email: socialEvent.contactEmail,
      roleType: RoleType.GROUP_MEMBER
    };
  }

  attachmentTitle(socialEvent: SocialEvent) {
    return socialEvent?.attachment ? (socialEvent.attachment.title || `Attachment: ${socialEvent.attachment.originalFileName}`) : "";
  }

  socialEventLink(socialEvent: SocialEvent, relative: boolean) {
    return socialEvent?.id ? this.urlService.linkUrl({area: this.pageService.socialPage()?.href, id: socialEvent?.id, relative}) : undefined;
  }

  copyToClipboard(socialEvent: SocialEvent, pop: TooltipDirective) {
    // this.clipboardService.copyToClipboardWithTooltip(this.socialEventLink(socialEvent), pop);
  }

  attachmentUrl(socialEvent) {
    return socialEvent?.attachment ? `${this.urlService.baseUrl()}/${this.attachmentBaseUrl}/${socialEvent.attachment.awsFileName}` : "";
  }

  attendeeList(socialEvent: SocialEvent, members: MemberFilterSelection[]) {
    return socialEvent?.attendees.map(memberId => members.find(member => member.id === memberId.id))
      .sort(sortBy("text")).map(item => item?.text).join(", ");
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
    return {
      id: member.id,
      order: 0,
      memberGrouping: `Social Member`,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
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
