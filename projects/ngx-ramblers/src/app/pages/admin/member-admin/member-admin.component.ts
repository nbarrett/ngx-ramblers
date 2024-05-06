import { Component, OnDestroy, OnInit } from "@angular/core";
import { faSearch, faToggleOff, faToggleOn, faUserXmark } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import extend from "lodash-es/extend";
import groupBy from "lodash-es/groupBy";
import keys from "lodash-es/keys";
import map from "lodash-es/map";
import sortBy from "lodash-es/sortBy";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { DuplicateMember, Member } from "../../../models/member.model";
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
import { MailchimpListSubscriptionService } from "../../../services/mailchimp/mailchimp-list-subscription.service";
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
              private notifierService: NotifierService,
              private systemConfigService: SystemConfigService,
              private memberBulkDeleteService: MemberBulkDeleteService,
              private walksService: WalksService,
              private dateUtils: DateUtilsService,
              private mailchimpListService: MailchimpListService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpListUpdaterService: MailchimpListUpdaterService,
              private profileService: ProfileService,
              private memberLoginService: MemberLoginService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberAdminComponent, NgxLoggerLevel.OFF);
    this.apiResponseProcessorlogger = loggerFactory.createLogger(MemberAdminComponent, NgxLoggerLevel.OFF);
    this.searchChangeObservable = new Subject<string>();
  }
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  private apiResponseProcessorlogger: Logger;
  private today: number;
  public members: Member[] = [];
  public bulkDeleteMarkedMemberIds: string[] = [];
  public quickSearch = "";
  private searchChangeObservable: Subject<string>;
  public memberFilter: MemberTableFilter;

  private memberFilterUploaded: any;
  filters: any;
  private subscriptions: Subscription[] = [];
  public confirm = new Confirm();
  faSearch = faSearch;
  faUserXmark = faUserXmark;
  public mailchimpConfig: MailchimpConfig;
  public noMailchimpListsConfigured: boolean;
  private walkLeaders: string[];

  protected readonly faToggleOff = faToggleOff;
  protected readonly faToggleOn = faToggleOn;

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
          {
            title: "Membership Date Active/Not set",
            group: "From Ramblers Supplied Datas",
            filter: member => !member.membershipExpiryDate || (member.membershipExpiryDate >= this.today)
          },
          {
            title: "Membership Date Expired",
            group: "From Ramblers Supplied Data",
            filter: member => member.membershipExpiryDate < this.today
          },
          {
            title: NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD,
            group: "From Ramblers Supplied Data",
            filter: member => !member.receivedInLastBulkLoad
          },
          {
            title: "Was received in last Ramblers Bulk Load",
            group: "From Ramblers Supplied Data",
            filter: member => member.receivedInLastBulkLoad
          },
          {
            title: "Password Expired", group: "Other Settings", filter: member => member.expiredPassword
          },
          {
            title: "Walk Admin", group: "Administrators", filter: member => member.walkAdmin
          },
          {
            title: "Walk Change Notifications",
            group: "Administrators",
            filter: member => member.walkChangeNotifications
          },
          {
            title: "Social Admin", group: "Administrators", filter: member => member.socialAdmin
          },
          {
            title: "Member Admin", group: "Administrators", filter: member => member.memberAdmin
          },
          {
            title: "Finance Admin", group: "Administrators", filter: member => member.financeAdmin
          },
          {
            title: "File Admin", group: "Administrators", filter: member => member.fileAdmin
          },
          {
            title: "Treasury Admin", group: "Administrators", filter: member => member.treasuryAdmin
          },
          {
            title: "Content Admin", group: "Administrators", filter: member => member.contentAdmin
          },
          {
            title: "Committee Member", group: "Administrators", filter: member => member.committee
          },
          {
            title: "Walk Leader", group: "Administrators", filter: member => this.isWalkLeader(member)
          },
          this.mailchimpConfig?.lists?.general ? {
            title: "Subscribed to the General emails list",
            group: "Email Subscriptions",
            filter: this.memberService.filterFor.GENERAL_MEMBERS_SUBSCRIBED
          } : null,
          this.mailchimpConfig?.lists?.walks ? {
            title: "Subscribed to the Walks email list",
            group: "Email Subscriptions",
            filter: this.memberService.filterFor.WALKS_MEMBERS_SUBSCRIBED
          } : null,
          this.mailchimpConfig?.lists?.socialEvents ? {
            title: "Subscribed to the Social email list",
            group: "Email Subscriptions",
            filter: this.memberService.filterFor.SOCIAL_MEMBERS_SUBSCRIBED
          } : null,
        ].filter(item => item)
      };
      this.memberFilter.selectedFilter = this.memberFilter.availableFilters[0];
      this.logger.info("mailchimpConfig:", mailchimpConfig, "this.noMailchimpListsConfigured", this.noMailchimpListsConfigured);
      this.refreshMembers();
    });
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(async item => {
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
    this.subscriptions.push(this.memberService.notifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.members = this.apiResponseProcessor.processResponse(this.apiResponseProcessorlogger, this.members, apiResponse);
        this.applyFilterToMembers();
      }
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
    this.logger.off("showMemberDialog:", editMode, member);
    this.modalService.show(MemberAdminModalComponent, {
      class: "modal-xl",
      animated: false,
      show: true,
      initialState: {
        editMode,
        member: cloneDeep(member),
        members: this.members,
        mailchimpConfig: this.mailchimpConfig,
      }
    });
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
        members: this.members
      }, initialState)
    };
  }

  applySortTo(field: string, filterSource: MemberTableFilter) {
    this.logger.off("sorting by field", field, "current value of filterSource", filterSource);
    filterSource.sortField = field;
    filterSource.sortFunction = field === "memberName" ? MEMBER_SORT : field === "markedForDelete" ? (member) => this.markedForDelete(member.id) : field;
    filterSource.reverseSort = !filterSource.reverseSort;
    filterSource.sortDirection = filterSource.reverseSort ? DESCENDING : ASCENDING;
    this.logger.off("sorting by field", field, "new value of filterSource", filterSource);
    this.applyFilterToMembers();
  }

  sortMembersUploadedBy(field) {
    this.applySortTo(field, this.memberFilterUploaded);
  }

  sortMembersBy(field: string) {
    this.applySortTo(field, this.memberFilter);
  }

  showMembersColumn(field) {
    return this.memberFilter.sortField === field;
  }

  addMember() {
    const member: Member = {};
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
          this.analyseDuplicates("mailchimpLists.general.web_id");
          this.analyseDuplicates("mailchimpLists.social.web_id");
          this.analyseDuplicates("mailchimpLists.walks.web_id");
          this.logger.off("refreshMembers:found", refreshedMembers.length, "members");
          this.applyFilterToMembers();
          return this.members;
        });
    }
  }

  private analyseDuplicates(fieldName: string) {
    const groupedByField: { [key: string]: Member[] } = groupBy(this.members, fieldName);
    const mapped: DuplicateMember[] = map(groupedByField, (duplicates, fieldValue) => ({
      fieldName,
      fieldValue,
      duplicates
    })).filter(item => item.fieldValue && item.fieldValue !== "undefined" && item.duplicates.length > 1);
    this.logger.info("analyseDuplicates for:", fieldName, mapped.length === 0 ? "no duplicates found" : mapped);
  }

  updateMailchimpLists() {
    this.mailchimpListUpdaterService.updateMailchimpLists(this.notify, this.members);
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

  bulkUnsubscribe() {
    this.confirm.as(ConfirmType.BULK_ACTION);
  }

  clearOutstandingAction() {
    this.confirm.clear();
  }

  confirmBulkUnsubscribe() {
    this.mailchimpListSubscriptionService.setMailchimpSubscriptionsStateFor(this.memberFilter.results, false, this.notify)
      .then(() => this.confirm.clear());
  }

  cancelBulkDelete() {
    this.confirm.clear();
    this.markNoneForBulkDelete();
    this.notify.hide();
  }

  confirmBulkDelete() {
    this.memberBulkDeleteService.performBulkDelete(this.members, this.bulkDeleteMarkedMemberIds)
      .then(() => this.cancelBulkDelete());
  }

  markAllForBulkDelete() {
    this.logger.info("markAllForBulkDelete");
    this.bulkDeleteMarkedMemberIds = this.memberFilter.results.map(item => item.id);
    this.notifyDeletionInstructions();
  }

  markNoneForBulkDelete() {
    this.logger.info("markNoneForBulkDelete");
    this.bulkDeleteMarkedMemberIds = [];
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
}
