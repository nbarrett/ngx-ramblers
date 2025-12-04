import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { extend } from "es-toolkit/compat";
import { sortBy } from "es-toolkit/compat";
import { isNull } from "es-toolkit/compat";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member, MemberBulkLoadAudit } from "../../../models/member.model";
import {
  ASCENDING,
  DESCENDING,
  MEMBER_SORT,
  MemberTableFilter,
  NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD,
  SELECT_ALL,
  TableFilterItem
} from "../../../models/table-filtering.model";
import { Confirm, ConfirmType, EditMode, StoredValue } from "../../../models/ui-actions";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ApiResponseProcessor } from "../../../services/api-response-processor.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { MemberAdminModalComponent } from "../member-admin-modal/member-admin-modal.component";
import { ProfileService } from "../profile/profile.service";
import { SendEmailsModalComponent } from "../send-emails/send-emails-modal.component";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MemberBulkDeleteService } from "../../../services/member/member-bulk-delete.service";
import { MailProvider, SystemConfig } from "../../../models/system.model";
import { ListInfo, MailMessagingConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { uniq } from "es-toolkit/compat";
import { MemberBulkLoadAuditService } from "../../../services/member/member-bulk-load-audit.service";
import { MemberDefaultsService } from "../../../services/member/member-defaults.service";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { faSearch, faUserCheck, faUserXmark } from "@fortawesome/free-solid-svg-icons";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass, TitleCasePipe } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SwitchIconComponent } from "../system-settings/committee/switch-icon";
import { DisplayDateNoDayPipe } from "../../../pipes/display-date-no-day.pipe";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ActivatedRoute, Router } from "@angular/router";
import { UiActionsService } from "../../../services/ui-actions.service";
import { MemberTerm } from "../../../models/member.model";


@Component({
    selector: "app-member-admin",
    templateUrl: "./member-admin.component.html",
    styleUrls: ["./member-admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, NgClass, TooltipDirective, SwitchIconComponent, TitleCasePipe, DisplayDateNoDayPipe, FullNameWithAliasPipe]
})
export class MemberAdminComponent implements OnInit, OnDestroy {

  private loggerFactory = inject(LoggerFactory);
  private logger: Logger = this.loggerFactory.createLogger("MemberAdminComponent", NgxLoggerLevel.ERROR);
  private apiResponseProcessorLogger: Logger = this.loggerFactory.createLogger("MemberAdminComponentResponseProcessor", NgxLoggerLevel.ERROR);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private mailchimpConfigService = inject(MailchimpConfigService);
  private memberService = inject(MemberService);
  private apiResponseProcessor = inject(ApiResponseProcessor);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private modalService = inject(BsModalService);
  private mailMessagingService = inject(MailMessagingService);
  private notifierService = inject(NotifierService);
  private systemConfigService = inject(SystemConfigService);
  private memberBulkDeleteService = inject(MemberBulkDeleteService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private dateUtils = inject(DateUtilsService);
  private memberDefaultsService = inject(MemberDefaultsService);
  private profileService = inject(ProfileService);
  private memberLoginService = inject(MemberLoginService);
  private searchChangeObservable: Subject<string> = new Subject<string>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private uiActionsService: UiActionsService = inject(UiActionsService);
  public mailchimpConfig: MailchimpConfig;
  protected mailMessagingConfig: MailMessagingConfig;
  private latestMemberBulkLoadAudit: MemberBulkLoadAudit;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private today: number;
  public members: Member[] = [];
  public bulkDeleteMarkedMemberIds: string[] = [];
  public quickSearch = "";
  public memberFilter: MemberTableFilter;
  filters: any;
  private subscriptions: Subscription[] = [];
  public confirm = new Confirm();
  private walkLeaders: string[];
  public systemConfig: SystemConfig;
  protected readonly MailProvider = MailProvider;
  protected readonly faUserXmark = faUserXmark;
  protected readonly faSearch = faSearch;
  protected readonly faUserCheck = faUserCheck;
  protected readonly MemberTerm = MemberTerm;
  private storedSortField = "";
  private storedSortDescending = false;
  private storedSortParamField = "";

  async ngOnInit() {
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const searchParam = params.get(this.stringUtilsService.kebabCase(StoredValue.SEARCH));
      const sortFieldParam = params.get(this.stringUtilsService.kebabCase(StoredValue.SORT));
      const sortOrderParam = params.get(this.stringUtilsService.kebabCase(StoredValue.SORT_ORDER));
      if (!isNull(searchParam)) {
        this.quickSearch = searchParam;
        this.uiActionsService.saveValueFor(StoredValue.SEARCH, this.quickSearch);
      } else {
        this.quickSearch = this.uiActionsService.initialValueFor(StoredValue.SEARCH, "") as string;
      }
      const storedSortField = sortFieldParam
        ? this.resolveSortField(sortFieldParam)
        : this.uiActionsService.initialValueFor(StoredValue.SORT, "") as string;
      const storedSortOrder = sortOrderParam || this.uiActionsService.initialValueFor(StoredValue.SORT_ORDER, "") as string;
      this.storedSortParamField = sortFieldParam || "";
      this.parseStoredSort(storedSortField, storedSortOrder);
    }));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.mailchimpConfig = await this.mailchimpConfigService.getConfig();
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(async (systemConfig: SystemConfig) => {
      this.systemConfig = systemConfig;
      this.logger.debug("retrieved systemConfig", systemConfig);
      this.walkLeaders = await this.walksAndEventsService.queryWalkLeaders();
      this.logger.info("walkLeaders:", this.walkLeaders);
    }));
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.logger.off("ngOnInit");
    this.notify.setBusy();
    this.today = this.dateUtils.dateTimeNowNoTime().toMillis();
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
        this.mailMessagingConfig = mailMessagingConfig;
        this.logger.info("retrieved MailMessagingConfig event:", mailMessagingConfig?.mailConfig);
        this.generateFilters();
        this.refreshMembers();
      }));
  }

  private generateFilters() {
    const filter1: TableFilterItem[] = [
      {
        title: "Active Group Member", group: "Group Settings", filter: this.memberService.filterFor.GROUP_MEMBERS
      },
      {
        title: "All Members", filter: SELECT_ALL
      },
      {
        title: "Active Social Member", group: "Group Settings", filter: this.memberService.filterFor.SOCIAL_MEMBERS
      }];
    const filter2: TableFilterItem[] = this.subscribedToLists();
    const filter3: TableFilterItem[] = [
      {
        title: "Membership Date Active/Not set",
        group: "From Ramblers Supplied Data",
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
        title: "Email Marketing Consent Given",
        group: "From Ramblers Supplied Data",
        filter: (member: Member) => member.emailMarketingConsent
      },
      {
        title: "Email Marketing Consent Not Given",
        group: "From Ramblers Supplied Data",
        filter: (member: Member) => !member.emailMarketingConsent
      },
      {
        title: "Email Marketing Consent Not Given and Subscribed to Email Lists",
        group: "From Ramblers Supplied Data",
        filter: (member: Member) => !member.emailMarketingConsent && this.mailListUpdaterService.memberSubscribedToAnyList(member)
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
    ];
    this.memberFilter = {
      sortField: "memberName",
      sortFunction: MEMBER_SORT,
      reverseSort: false,
      sortDirection: ASCENDING,
      results: [],
      availableFilters: (filter1.concat(filter2).concat(filter3)).filter(item => item)
    };
    this.applyStoredSort();
    this.logger.info("filters:", filter1, filter2, filter3);
    this.memberFilter.selectedFilter = this.memberFilter.availableFilters[0];
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
      this.persistFilters();
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
    } else if (this.mailMessagingConfig?.brevo?.lists?.lists.map(listInfo => listInfo.name).includes(field)) {
      return (member: Member) => member.mail?.subscriptions?.find(sub => sub.id === this.mailMessagingConfig?.brevo?.lists?.lists?.find(item => item.name === field)?.id)?.subscribed;
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
    this.memberDefaultsService.applyDefaultMailSettingsToMember(member, this.systemConfig, this.mailMessagingConfig);
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

  beginBulkMemberDelete() {
    this.confirm.as(ConfirmType.BULK_DELETE);
    this.notifyDeletionInstructions();
  }

  private notifyDeletionInstructions() {
    this.notify.warning({
      title: "Member Bulk Delete Started",
      message: "Select individual members to include/exclude in bulk delete by clicking the leftmost column on a member. Or click Select All button to mark all " + this.memberFilter.results.length + " members for deletion. When you have completed your selection, click Confirm Deletion of " + this.bulkDeleteMarkedMemberIds.length + " members to physically delete them, or Cancel to exit the process without making any changes."
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
    await this.updateLists();
    this.cancelBulkDelete();
  }

  public async updateLists() {
    await this.memberDefaultsService.updateLists(this.systemConfig, this.notify, this.members);
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

  subscriptionFor(member: Member, listInfo: ListInfo): boolean {
    return member?.mail?.subscriptions?.find(sub => sub.id === listInfo.id)?.subscribed;
  }

  receivedInLastBulkLoad(member: Member): boolean {
    return this.memberBulkLoadAuditService.receivedInBulkLoad(member, true, this.latestMemberBulkLoadAudit);
  }

  private subscribedToLists(): TableFilterItem[] {
    if (this.systemConfig?.mailDefaults?.mailProvider === MailProvider.NONE) {
      return [];
    } else {
      return this.mailMessagingConfig?.brevo?.lists?.lists.map(list => ({
        title: `Subscribed to ${list.name} emails`,
        group: "Email Subscriptions",
        filter: (member: Member) => this.memberDefaultsService.subscribedToEmails(member, this.systemConfig, list.id),
      }));
    }
  }

  private parseStoredSort(field: string, order: string) {
    if (!field) {
      return;
    }
    this.storedSortField = field;
    this.storedSortDescending = order === "desc";
  }

  private applyStoredSort() {
    if (this.memberFilter && this.storedSortField) {
      const resolvedField = this.resolveSortField(this.storedSortParamField || this.storedSortField) || this.storedSortField;
      this.memberFilter.sortField = resolvedField;
      this.memberFilter.sortFunction = this.deriveSortFunction(resolvedField);
      this.memberFilter.reverseSort = this.storedSortDescending;
      this.memberFilter.sortDirection = this.storedSortDescending ? DESCENDING : ASCENDING;
    } else if (this.memberFilter) {
      this.memberFilter.sortField = "memberName";
      this.memberFilter.sortFunction = MEMBER_SORT;
    }
  }

  private replaceQueryParams(params: Record<string, any>) {
    this.router.navigate([], {queryParams: params, queryParamsHandling: "merge"});
  }

  private persistFilters() {
    if (!this.memberFilter) {
      return;
    }
    const sortField = this.memberFilter.sortField;
    const sortOrder = this.memberFilter.reverseSort ? "desc" : "asc";
    this.uiActionsService.saveValueFor(StoredValue.SEARCH, this.quickSearch || "");
    this.uiActionsService.saveValueFor(StoredValue.SORT, sortField);
    this.uiActionsService.saveValueFor(StoredValue.SORT_ORDER, sortOrder);
    this.replaceQueryParams({
      [this.stringUtilsService.kebabCase(StoredValue.SEARCH)]: this.quickSearch || null,
      [this.stringUtilsService.kebabCase(StoredValue.SORT)]: this.stringUtilsService.kebabCase(sortField) || null,
      [this.stringUtilsService.kebabCase(StoredValue.SORT_ORDER)]: sortOrder
    });
  }

  private resolveSortField(paramField: string): string {
    if (!paramField) {
      return "";
    }
    const candidate = paramField.toLowerCase();
    const defaultFields = [
      "memberName",
      "email",
      "mobileNumber",
      "createdDate",
      "membershipExpiryDate",
      "receivedInLastBulkLoad",
      "groupMember",
      "socialMember"
    ];
    const defaultMatch = defaultFields.find(field => this.stringUtilsService.kebabCase(field) === candidate);
    if (defaultMatch) {
      return defaultMatch;
    }
    const brevoListMatch = this.mailMessagingConfig?.brevo?.lists?.lists?.find(list => this.stringUtilsService.kebabCase(list.name) === candidate)?.name;
    if (brevoListMatch) {
      return brevoListMatch;
    }
    return paramField;
  }
}
