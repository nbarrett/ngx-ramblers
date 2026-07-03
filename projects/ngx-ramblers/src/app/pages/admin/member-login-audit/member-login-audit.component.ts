import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCheck, faSearch, faXmark } from "@fortawesome/free-solid-svg-icons";
import { isArray } from "es-toolkit/compat";
import { sortBy } from "es-toolkit/compat";
import { toPairs } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import { ApiAction, ApiResponse } from "../../../models/api-response.model";
import { DateValue } from "../../../models/date.model";
import { Member, MemberAuthAudit } from "../../../models/member.model";
import { ASCENDING, DESCENDING, MEMBER_SORT, MemberAuthAuditTableFilter } from "../../../models/table-filtering.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberAuthAuditService } from "../../../services/member/member-auth-audit.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StoredValue } from "../../../models/ui-actions";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { ProfileService } from "../profile/profile.service";
import { PageComponent } from "../../../page/page.component";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { DatePicker } from "../../../date-and-time/date-picker";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";

const SORT_FIELD_FOR_ALIAS: Record<string, string> = {
  "login-time": "loginTime",
  "user-name": "userName",
  member: "member",
  "login-successful": "loginResponse.memberLoggedIn",
  "login-response": "loginResponse.alertMessage"
};

@Component({
    selector: "app-member-admin",
    templateUrl: "./member-login-audit.component.html",
    imports: [PageComponent, NgClass, FontAwesomeModule, FormsModule, DatePicker, DisplayDateAndTimePipe, FullNameWithAliasPipe]
})
export class MemberLoginAuditComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberLoginAuditComponent", NgxLoggerLevel.ERROR);
  private memberService = inject(MemberService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private notifierService = inject(NotifierService);
  private dateUtils = inject(DateUtilsService);
  private urlService = inject(UrlService);
  private memberAuthAuditService = inject(MemberAuthAuditService);
  private profileService = inject(ProfileService);
  private uiActions = inject(UiActionsService);
  private searchChangeObservable: Subject<string> = new Subject<string>();
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public quickSearch = "";
  private members: Member[] = [];
  public auditFilter: MemberAuthAuditTableFilter;
  private memberFilterUploaded: any;
  private subscriptions: Subscription[] = [];
  private memberAudits: MemberAuthAudit[] = [];
  filterDateValue: DateValue;
  faSearch = faSearch;
  protected readonly faCheck = faCheck;
  protected readonly faXmark = faXmark;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.filterDateValue = this.dateUtils.asDateValue(this.dateUtils.dateTimeNowNoTime().minus({ weeks: 2 }));
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => this.applyFilterToAudits(searchTerm)));
    const requestedSortAlias = this.uiActions.queryParameter(StoredValue.SORT);
    const requestedSortField = (requestedSortAlias && SORT_FIELD_FOR_ALIAS[requestedSortAlias]) || "loginTime";
    const requestedSortDirection = this.uiActions.queryParameter(StoredValue.SORT_ORDER);
    const reverseSort = requestedSortDirection ? requestedSortDirection !== "ascending" : true;
    this.auditFilter = {
      sortField: requestedSortField,
      sortFunction: requestedSortField === "memberName" ? MEMBER_SORT : requestedSortField,
      reverseSort,
      sortDirection: reverseSort ? DESCENDING : ASCENDING,
      results: []
    };
    this.logger.debug("this.memberFilter:", this.auditFilter);
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.subscriptions.push(this.memberAuthAuditService.notifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.addAuditItemsToView(apiResponse);
      }
    }));
    this.refreshMembers();
    this.refreshMemberAudit();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  refreshMemberAudit() {
    this.memberAuthAuditService.all({criteria: {loginTime: {$gte: this.filterDateValue.value}}, sort: {loginTime: -1}});
  }

  private addAuditItemsToView(apiResponse: ApiResponse) {
    const authAudits: MemberAuthAudit[] = isArray(apiResponse.response) ? apiResponse.response : [apiResponse.response];
    this.logger.debug("Received", authAudits.length, "member auth audit", apiResponse.action, "notification(s)");
    if (apiResponse.action === ApiAction.QUERY) {
      this.memberAudits = authAudits;
    } else {
      authAudits.forEach(notifiedMemberAuthAudit => {
        const existingMemberAuthAudit: MemberAuthAudit = this.memberAudits.find(member => member.id === notifiedMemberAuthAudit.id);
        if (existingMemberAuthAudit) {
          if (apiResponse.action === ApiAction.DELETE) {
            this.logger.debug("deleting", notifiedMemberAuthAudit);
            this.memberAudits = this.memberAudits.filter(member => member.id !== notifiedMemberAuthAudit.id);
          } else {
            this.logger.debug("replacing", notifiedMemberAuthAudit);
            this.memberAudits[(this.memberAudits.indexOf(existingMemberAuthAudit))] = notifiedMemberAuthAudit;
          }
        } else {
          this.logger.debug("adding", notifiedMemberAuthAudit);
          this.memberAudits.push(notifiedMemberAuthAudit);
        }
      });
    }
    this.applyFilterToAudits();
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  applyFilterToAudits(searchTerm?: string) {
    this.notify.setBusy();
    const sort = this.auditFilter.sortField;
    this.logger.debug("applyFilterToAudits:sort:", sort, "reverseSort:", this.auditFilter.reverseSort);
    const filteredAudits = sortBy(this.searchFilterPipe.transform(this.memberAudits, this.quickSearch), sort);
    this.auditFilter.results = this.auditFilter.reverseSort ? filteredAudits.reverse() : filteredAudits;
    this.logger.debug("applyFilterToMembers:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.quickSearch, "filtered", this.memberAudits.length, "members ->", this.auditFilter.results.length, "sort", sort, "this.memberFilter.reverseSort", this.auditFilter.reverseSort);
    this.notifyProgress(`showing ${this.auditFilter.results.length} records`);
    this.notify.clearBusy();
  }

  private notifyProgress(message: string) {
    this.notify.progress({title: "Member login audit", message});
  }

  applySortTo(field, filterSource) {
    this.logger.debug("sorting by field", field, "current value of filterSource", filterSource);
    filterSource.sortField = field;
    filterSource.sortFunction = field === "memberName" ? MEMBER_SORT : field;
    filterSource.reverseSort = !filterSource.reverseSort;
    filterSource.sortDirection = filterSource.reverseSort ? DESCENDING : ASCENDING;
    this.logger.debug("sorting by field", field, "new value of filterSource", filterSource);
    this.uiActions.updateQueryParameters({
      [StoredValue.SORT]: this.sortAliasFor(filterSource.sortField),
      [StoredValue.SORT_ORDER]: filterSource.reverseSort ? "descending" : "ascending"
    });
    this.applyFilterToAudits();
  }

  private sortAliasFor(sortField: string): string {
    return toPairs(SORT_FIELD_FOR_ALIAS).find(([, field]) => field === sortField)?.[0] || sortField;
  }

  sortMembersUploadedBy(field) {
    this.applySortTo(field, this.memberFilterUploaded);
  }

  sortAuditBy(field) {
    this.applySortTo(field, this.auditFilter);
  }

  showAuditColumn(field) {
    return this.auditFilter.sortField === field;
  }

  refreshMembers(): any {
    this.notify.setBusy();
    this.memberService.publicFields()
      .then(refreshedMembers => {
        this.members = refreshedMembers;
        this.logger.debug("refreshMembers:found", refreshedMembers.length, "members");
      });
  }

  onFilterDateChange(dateValue: DateValue) {
    this.notify.setBusy();
    this.logger.debug("date change", dateValue, "filterDate:", this.filterDateValue.value);
    this.filterDateValue = dateValue;
    this.notifyProgress("finding audit data...");
    this.refreshMemberAudit();
  }

  backToAdmin() {
    this.urlService.backToAdmin();
  }
}
