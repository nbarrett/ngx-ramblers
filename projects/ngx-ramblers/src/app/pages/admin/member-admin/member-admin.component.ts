import { Component, OnDestroy, OnInit } from "@angular/core";
import { faSearch, faUserXmark } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import extend from "lodash-es/extend";
import keys from "lodash-es/keys";
import sortBy from "lodash-es/sortBy";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member, MemberBulkLoadAudit } from "../../../models/member.model";
import {
  ASCENDING,
  DESCENDING,
  MEMBER_SORT,
  MemberTableFilter,
  NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD,
  SELECT_ALL
} from "../../../models/table-filtering.model";
import { Confirm, ConfirmType, EditMode } from "../../../models/ui-actions";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ApiResponseProcessor } from "../../../services/api-response-processor.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpListUpdaterService } from "../../../services/mailchimp/mailchimp-list-updater.service";
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { MemberAdminModalComponent } from "../member-admin-modal/member-admin-modal.component";
import { ProfileService } from "../profile/profile.service";
import { SendEmailsModalComponent } from "../send-emails/send-emails-modal.component";
import { WalksService } from "../../../services/walks/walks.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MemberBulkDeleteService } from "../../../services/member/member-bulk-delete.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { MailProvider, SystemConfig } from "../../../models/system.model";
import { MailConfig, MailMessagingConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { KeyValue } from "../../../services/enums";
import uniq from "lodash-es/uniq";
import { MemberBulkLoadAuditService } from "../../../services/member/member-bulk-load-audit.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-member-admin",
  templateUrl: "./member-admin.component.html",
  styleUrls: ["./member-admin.component.sass"]
})
export class MemberAdminComponent implements OnInit, OnDestroy {

  constructor(private mailchimpConfigService: MailchimpConfigService,
              private memberService: MemberService,
              private apiResponseProcessor: ApiResponseProcessor,
              private searchFilterPipe: SearchFilterPipe,
              private modalService: BsModalService,
              private mailMessagingService: MailMessagingService,
              private notifierService: NotifierService,
              private systemConfigService: SystemConfigService,
              private memberBulkDeleteService: MemberBulkDeleteService,
              private memberBulkLoadAuditService: MemberBulkLoadAuditService,
              private walksService: WalksService,
              private stringUtils: StringUtilsService,
              private dateUtils: DateUtilsService,
              public mailListUpdaterService: MailListUpdaterService,
              private mailchimpListService: MailchimpListService,
              private mailchimpListUpdaterService: MailchimpListUpdaterService,
              private profileService: ProfileService,
              private memberLoginService: MemberLoginService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberAdminComponent, NgxLoggerLevel.OFF);
    this.apiResponseProcessorLogger = loggerFactory.createLogger(MemberAdminComponent, NgxLoggerLevel.OFF);
    this.searchChangeObservable = new Subject<string>();
  }

  private latestMemberBulkLoadAudit: MemberBulkLoadAudit;
  public listsAsKeyValues: KeyValue<number>[];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  private apiResponseProcessorLogger: Logger;
  private today: number;
  public members: Member[] = [];
  public bulkDeleteMarkedMemberIds: string[] = [];
  public quickSearch = "";
  private searchChangeObservable: Subject<string>;
  public memberFilter: MemberTableFilter;
  public mailConfig: MailConfig;
  filters: any;
  private subscriptions: Subscription[] = [];
  public confirm = new Confirm();
  faSearch = faSearch;
  faUserXmark = faUserXmark;
  public mailchimpConfig: MailchimpConfig;
  public noMailchimpListsConfigured: boolean;
  private walkLeaders: string[];
  public systemConfig: SystemConfig;
  protected readonly MailProvider = MailProvider;

  async ngOnInit() {
    this.mailchimpConfigService.getConfig().then((mailchimpConfig: MailchimpConfig) => {
      this.mailchimpConfig = mailchimpConfig;
      this.noMailchimpListsConfigured = keys(mailchimpConfig.lists).length === 0;
      this.memberFilter = {
        sortField: "memberName",
        sortFunction: MEMBER_SORT,
        reverseSort: false,
        sortDirection: ASCENDING,
        results: [],
        availableFilters: [
          {
            title: "Active Group Member", group: "Group Settings", filter: this.memberService.filterFor.GROUP_MEMBERS
          },
          {
            title: "All Members", filter: SELECT_ALL
          },
          {
            title: "Active Social Member", group: "Group Settings", filter: this.memberService.filterFor.SOCIAL_MEMBERS
          },
          this.systemConfig?.mailDefaults?.mailProvider !== MailProvider.NONE ? {
            title: `Subscribed to ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)} Campaign Email`,
            group: "Email Subscriptions",
            filter: (member: Member) => this.subscribedToEmails(member)
          } : null,
          {
            title: "Membership Date Active/Not set",
            group: "From Ramblers Supplied Datas",
            filter: (member: Member) => !member.membershipExpiryDate || (member.membershipExpiryDate >= this.today)
          },
          {
            title: "Membership Date Expired",
            group: "From Ramblers Supplied Data",
            filter: (member: Member) => member.membershipExpiryDate < this.today
          },
          {
            title: NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD,
            group: "From Ramblers Supplied Data",
            filter: (member: Member) => !this.receivedInLastBulkLoad(member)
          },
          {
            title: "Was received in last Ramblers Bulk Load",
            group: "From Ramblers Supplied Data",
            filter: (member: Member) => this.receivedInLastBulkLoad(member)
          },
          {
            title: "Password Expired", group: "Other Settings", filter: (member: Member) => member.expiredPassword
          },
          {
            title: "Walk Admin", group: "Administrators", filter: (member: Member) => member.walkAdmin
          },
          {
            title: "Walk Change Notifications",
            group: "Administrators",
            filter: (member: Member) => member.walkChangeNotifications
          },
          {
            title: "Social Admin", group: "Administrators", filter: (member: Member) => member.socialAdmin
          },
          {
            title: "Member Admin", group: "Administrators", filter: (member: Member) => member.memberAdmin
          },
          {
            title: "Finance Admin", group: "Administrators", filter: (member: Member) => member.financeAdmin
          },
          {
            title: "File Admin", group: "Administrators", filter: (member: Member) => member.fileAdmin
          },
          {
            title: "Treasury Admin", group: "Administrators", filter: (member: Member) => member.treasuryAdmin
          },
          {
            title: "Content Admin", group: "Administrators", filter: (member: Member) => member.contentAdmin
          },
          {
            title: "Committee Member", group: "Administrators", filter: (member: Member) => member.committee
          },
          {
            title: "Walk Leader", group: "Administrators", filter: (member: Member) => this.isWalkLeader(member)
          }
        ].filter(item => item)
      };
      this.memberFilter.selectedFilter = this.memberFilter.availableFilters[0];
      this.logger.info("mailchimpConfig:", mailchimpConfig, "this.noMailchimpListsConfigured", this.noMailchimpListsConfigured);
      this.refreshMembers();
    });
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(async (systemConfig: SystemConfig) => {
      this.systemConfig = systemConfig;
      this.logger.debug("retrieved systemConfig", systemConfig);
      this.walkLeaders = await this.walksService.queryPreviousWalkLeaderIds();
      this.logger.info("walkLeaders:", this.walkLeaders);
    }));
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.logger.off("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.today = this.dateUtils.momentNowNoTime().valueOf();
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => this.applyFilterToMembers(searchTerm)));
    this.memberLoginService.showLoginPromptWithRouteParameter("expenseId");
    this.logger.off("this.memberFilter:", this.memberFilter);
    this.latestMemberBulkLoadAudit = await this.memberBulkLoadAuditService.findLatestBulkLoadAudit();
    this.subscriptions.push(this.memberService.changeNotifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.members = this.apiResponseProcessor.processResponse(this.apiResponseProcessorLogger, this.members, apiResponse);
        this.applyFilterToMembers();
      }
    }));
    this.subscriptions.push(this.memberService.deletionNotifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.members = this.apiResponseProcessor.processResponse(this.apiResponseProcessorLogger, this.members, apiResponse);
        this.applyFilterToMembers();
      }
    }));
    this.subscriptions.push(this.mailMessagingService.events()
      .subscribe((mailMessagingConfig: MailMessagingConfig) => {
        this.mailConfig = mailMessagingConfig.mailConfig;
        this.listsAsKeyValues = this.mailListUpdaterService.mapToKeyValues(mailMessagingConfig?.mailConfig?.lists);
        this.logger.info("retrieved MailMessagingConfig event:", mailMessagingConfig.mailConfig);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  isWalkLeader(member: Member): boolean {
    return this.walkLeaders.includes(member.id) || this.walkLeaders.includes(member.displayName);
  }

  onSearchChange(searchEntry: string) {
    this.logger.off("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  applyFilterToMembers(searchTerm?: string) {
    if (this.memberFilter) {
      this.notify.setBusy();
      const filter = this.memberFilter?.selectedFilter?.filter;
      const sort = this.memberFilter.sortFunction;
      this.logger.off("applyFilterToMembers:filter:", filter, "sort:", sort, "reverseSort:", this.memberFilter.reverseSort);
      const members = sortBy(this.searchFilterPipe.transform(this.members.filter(filter), this.quickSearch), sort);
      this.memberFilter.results = this.memberFilter.reverseSort ? members.reverse() : members;
      this.logger.off("applyFilterToMembers:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.quickSearch, "filtered", this.members.length, "members ->", this.memberFilter.results.length, "sort", sort, "this.memberFilter.reverseSort", this.memberFilter.reverseSort);
      this.notify.clearBusy();
    }
  }

  showMemberDialog(member: Member, editMode: EditMode) {
    this.notify.hide();
    const config = {
      class: "modal-xl",
      animated: false,
      show: true,
      initialState: {
        editMode,
        lastBulkLoadDate: this.latestMemberBulkLoadAudit?.createdDate,
        receivedInLastBulkLoad: this.receivedInLastBulkLoad(member),
        member: cloneDeep(member),
        members: this.members,
        mailchimpConfig: this.mailchimpConfig,
      }
    };
    this.logger.info("showMemberDialog:config:", config);
    this.modalService.show(MemberAdminModalComponent, config);
  }

  showSendEmailsDialog() {
    this.notify.hide();
    this.modalService.show(SendEmailsModalComponent, this.createModalOptions());
  }

  private createModalOptions(initialState?: any): ModalOptions {
    return {
      class: "modal-xl",
      animated: false,
      backdrop: "static",
      ignoreBackdropClick: false,
      keyboard: true,
      focus: true,
      show: true,
      initialState: extend({
        latestMemberBulkLoadAudit: this.latestMemberBulkLoadAudit,
        members: this.members
      }, initialState)
    };
  }

  applySortTo(field: string, filterSource: MemberTableFilter) {
    this.logger.off("sorting by field", field, "current value of filterSource", filterSource);
    filterSource.sortField = field;
    filterSource.sortFunction = this.deriveSortFunction(field);
    filterSource.reverseSort = !filterSource.reverseSort;
    filterSource.sortDirection = filterSource.reverseSort ? DESCENDING : ASCENDING;
    this.logger.off("sorting by field", field, "new value of filterSource", filterSource);
    this.applyFilterToMembers();
  }

  private deriveSortFunction(field: string) {
    if (field === "memberName") {
      return MEMBER_SORT;
    } else if (field === "markedForDelete") {
      return (member: Member) => this.markedForDelete(member.id);
    } else if (this.listsAsKeyValues.map(item => item.key).includes(field)) {
      return (member: Member) => member.mail?.subscriptions?.find(sub => sub.id === this.listsAsKeyValues.find(item => item.key === field)?.value)?.subscribed;
    } else {
      return field;
    }
  }

  sortMembersBy(field: string) {
    this.applySortTo(field, this.memberFilter);
  }

  showMembersColumn(field: string) {
    return this.memberFilter.sortField === field;
  }

  addMember() {
    const member: Member = {} as Member;
    this.mailchimpListService.defaultMailchimpSettings(member, true);
    member.groupMember = true;
    member.socialMember = true;
    this.showMemberDialog(member, EditMode.ADD_NEW);
  }

  editMember(member: Member) {
    this.showMemberDialog(member, EditMode.EDIT);
  }

  refreshMembers(memberFilter?: any) {
    if (memberFilter) {
      this.memberFilter.selectedFilter = memberFilter;
    }
    if (this.memberLoginService.allowMemberAdminEdits()) {
      this.notify.setBusy();
      return this.memberService.all()
        .then(refreshedMembers => {
          this.members = refreshedMembers;
          this.logger.off("refreshMembers:found", refreshedMembers.length, "members");
          this.applyFilterToMembers();
          return this.members;
        });
    }
  }

  updateLists(): Promise<any> {
    switch (this.systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        return this.updateBrevoLists();
      case MailProvider.MAILCHIMP:
        return this.updateMailchimpLists();
      default:
        return Promise.resolve();
    }
  }

  updateMailchimpLists() {
    return this.mailchimpListUpdaterService.updateMailchimpLists(this.notify, this.members);
  }

  updateBrevoLists() {
    return this.mailListUpdaterService.updateMailLists(this.notify, this.members)
      .catch(error => this.notify.error({title: "Error updating Brevo lists", message: error}));
  }

  beginBulkMemberDelete() {
    this.confirm.as(ConfirmType.BULK_DELETE);
    this.notifyDeletionInstructions();
  }

  private notifyDeletionInstructions() {
    this.notify.warning({
      title: "Member Bulk Delete Started",
      message: "Select individual members to include/exclude in bulk delete by clicking rightmost column on a member. Or click Select All button to mark all " + this.memberFilter.results.length + " members for deletion. When you have completed your selection, click Confirm Deletion of " + this.bulkDeleteMarkedMemberIds.length + " members to physically delete them, or Cancel to exit the process without making any changes."
    });
  }

  cancelBulkDelete() {
    this.confirm.clear();
    this.deselectAllForBulkDelete();
    this.notify.hide();
  }

  async confirmBulkDelete() {
    const deletedMembers = await this.memberBulkDeleteService.performBulkDelete(this.members, this.bulkDeleteMarkedMemberIds);
    this.logger.info("deletedMembers:", deletedMembers);
    this.updateLists();
    this.cancelBulkDelete();
  }

  selectAllForBulkDelete() {
    const itemsToAdd = this.memberFilter.results.map(item => item.id);
    this.logger.info("markAllForBulkDelete:itemsToAdd:", itemsToAdd);
    this.bulkDeleteMarkedMemberIds = uniq(this.bulkDeleteMarkedMemberIds.concat(itemsToAdd));
    this.notifyDeletionInstructions();
  }

  deselectAllForBulkDelete() {
    const itemsToRemove = this.memberFilter.results.map((member: Member) => member.id);
    this.logger.info("markNoneForBulkDelete:itemsToRemove:", itemsToRemove);
    this.bulkDeleteMarkedMemberIds = this.bulkDeleteMarkedMemberIds.filter(item => !itemsToRemove.includes(item));
    this.notifyDeletionInstructions();
  }

  markedForDelete(memberId: string): boolean {
    return this.bulkDeleteMarkedMemberIds.includes(memberId);
  }

  toggleDeletionMarker(memberId: string): void {
    if (this.markedForDelete(memberId)) {
      this.bulkDeleteMarkedMemberIds = this.bulkDeleteMarkedMemberIds.filter(item => item !== memberId);
    } else {
      this.bulkDeleteMarkedMemberIds.push(memberId);
    }
    this.notifyDeletionInstructions();
  }

  subscriptionFor(member: Member, keyValue: KeyValue<number>): boolean {
    return member?.mail?.subscriptions?.find(sub => sub.id === keyValue.value)?.subscribed;
  }

  receivedInLastBulkLoad(member: Member): boolean {
    return this.memberBulkLoadAuditService.receivedInBulkLoad(member, true, this.latestMemberBulkLoadAudit);
  }

  private subscribedToEmails(member: Member): boolean {
    switch (this.systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        return this.mailListUpdaterService.memberSubscribed(member);
      case MailProvider.MAILCHIMP:
        return this.mailchimpListService.memberSubscribedToAnyList(member);
      default:
        return false;
    }
  }
}
