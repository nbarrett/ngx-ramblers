import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import {
  faBan,
  faCircleCheck,
  faCircleInfo,
  faCirclePlus,
  faEnvelopesBulk,
  faPencil,
  faRemove, faSadTear,
  faSearch,
  faSpinner,
  faThumbsUp
} from "@fortawesome/free-solid-svg-icons";
import first from "lodash-es/first";
import groupBy from "lodash-es/groupBy";
import map from "lodash-es/map";
import reduce from "lodash-es/reduce";
import sortBy from "lodash-es/sortBy";
import { FileUploader } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { FontAwesomeIcon } from "../../../models/images.model";
import {
  Member,
  MemberBulkLoadAudit,
  MemberBulkLoadAuditApiResponse,
  MemberUpdateAudit,
  SessionStatus
} from "../../../models/member.model";
import { MailProvider, SystemConfig } from "../../../models/system.model";
import {
  ASCENDING,
  DESCENDING,
  MemberTableFilter,
  MemberUpdateAuditTableFilter
} from "../../../models/table-filtering.model";
import { EditMode } from "../../../models/ui-actions";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpListUpdaterService } from "../../../services/mailchimp/mailchimp-list-updater.service";
import { MemberBulkLoadAuditService } from "../../../services/member/member-bulk-load-audit.service";
import { MemberBulkLoadService } from "../../../services/member/member-bulk-load.service";
import { MemberUpdateAuditService } from "../../../services/member/member-update-audit.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { MemberAdminModalComponent } from "../member-admin-modal/member-admin-modal.component";
import { MailMessagingConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import cloneDeep from "lodash-es/cloneDeep";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MemberDefaultsService } from "../../../services/member/member-defaults.service";

@Component({
  selector: "app-bulk-load",
  templateUrl: "./member-bulk-load.component.html",
  styleUrls: ["./member-bulk-load.component.sass", "../admin/admin.component.sass"]
})
export class MemberBulkLoadComponent implements OnInit, OnDestroy {

  constructor(private mailchimpListUpdaterService: MailchimpListUpdaterService,
              public mailMessagingService: MailMessagingService,
              private mailListUpdaterService: MailListUpdaterService,
              private memberBulkLoadService: MemberBulkLoadService,
              private memberService: MemberService,
              private searchFilterPipe: SearchFilterPipe,
              private memberUpdateAuditService: MemberUpdateAuditService,
              private memberDefaultsService: MemberDefaultsService,
              private memberBulkLoadAuditService: MemberBulkLoadAuditService,
              private systemConfigService: SystemConfigService,
              private notifierService: NotifierService,
              private modalService: BsModalService,
              private stringUtils: StringUtilsService,
              private dateUtils: DateUtilsService,
              private urlService: UrlService,
              private authService: AuthService,
              private route: ActivatedRoute,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MemberBulkLoadComponent", NgxLoggerLevel.OFF);
  }
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  private searchChangeObservable: Subject<string>;
  public uploadSessionStatuses: SessionStatus[];
  public uploadSession: MemberBulkLoadAudit;
  public filters: {
    membersUploaded: MemberTableFilter;
    memberUpdateAudit: MemberUpdateAuditTableFilter;
  };
  public fileUploader: FileUploader = new FileUploader({
    url: "api/ramblers/monthly-reports/upload",
    disableMultipart: false,
    autoUpload: true,
    authTokenHeader: "Authorization",
    authToken: `Bearer ${this.authService.authToken()}`,
    formatDataFunctionIsAsync: false,
  });
  private mailMessagingConfig: MailMessagingConfig;
  public memberBulkLoadAudits: MemberBulkLoadAudit[] = [];
  public memberUpdateAudits: MemberUpdateAudit[] = [];
  public members: Member[] = [];
  public hasFileOver = false;
  public quickSearch = "";
  public memberTabHeading: string;
  public auditTabHeading: string;
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];
  faEnvelopesBulk = faEnvelopesBulk;
  faSearch = faSearch;

  protected readonly faSadTear = faSadTear;

  ngOnInit() {
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.logger.debug("loginResponse", loginResponse);
      this.urlService.navigateTo(["admin"]);
    }));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.logger.info("subscribing to mailMessagingService events:", mailMessagingConfig);
      this.mailMessagingConfig = mailMessagingConfig;
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.logger.info("subscribing to systemConfigService events:", systemConfig);
      this.systemConfig = systemConfig;
    }));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const tab = paramMap.get("tab");
      this.logger.debug("tab is", tab);
    }));

    this.searchChangeObservable = new Subject<string>();
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(() => this.filterLists()));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.fileUploader.response.subscribe((response: string | HttpErrorResponse) => {
      this.logger.debug("response", response, "type", typeof response);
      if (response instanceof HttpErrorResponse) {
        this.notify.error({title: "Upload failed", message: response.error});
      } else if (response === "Unauthorized") {
        this.notify.error({title: "Upload failed", message: response + " - try logging out and logging back in again and trying this again."});
      } else {
        const memberBulkLoadAuditApiResponse: MemberBulkLoadAuditApiResponse = JSON.parse(response);
        this.logger.debug("received response", memberBulkLoadAuditApiResponse);
        this.memberBulkLoadService.processResponse(this.mailMessagingConfig, this.systemConfig, memberBulkLoadAuditApiResponse, this.members, this.notify)
          .then(() => this.refreshMemberBulkLoadAudit())
          .then(() => this.refreshMemberUpdateAudit())
          .then(() => this.validateBulkUploadProcessing(memberBulkLoadAuditApiResponse))
          .then((validationSuccessful) => this.sendSubscriptionUpdates(validationSuccessful))
          .finally(() => this.clearBusy());

      }
    }));

    this.uploadSessionStatuses = [
      {title: "All"},
      {status: "created", title: "Created"},
      {status: "summary", title: "Summary"},
      {status: "skipped", title: "Skipped"},
      {status: "updated", title: "Updated"},
      {status: "error", title: "Error"}];

    this.filters = {
      memberUpdateAudit: {
        query: this.uploadSessionStatuses[0],
        sortFunction: "updateTime",
        sortField: "updateTime",
        availableFilters: [],
        reverseSort: true,
        sortDirection: DESCENDING,
        results: [],
      },
      membersUploaded: {
        query: "",
        sortFunction: "email",
        sortField: "email",
        reverseSort: true,
        sortDirection: DESCENDING,
        results: [],
      }
    };

    this.memberService.all().then(members => {
      this.logger.debug("found:members", members.length);
      this.members = members;
    });

    this.memberBulkLoadAuditService.all({
      sort: {createdDate: -1}
    }).then(memberBulkLoadAudits => {
      this.logger.debug("found", memberBulkLoadAudits.length, "memberBulkLoadAudits");
      this.memberBulkLoadAudits = memberBulkLoadAudits;
      this.uploadSession = first(this.memberBulkLoadAudits);
      this.uploadSessionChanged();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private filterLists(searchTerm?: string) {
    this.applyFilterToList(this.filters.membersUploaded, this.uploadSession.members);
    this.applyFilterToList(this.filters.memberUpdateAudit, this.memberUpdateAudits);
    this.updateTabHeadings();
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  currentMemberBulkLoadDisplayDate() {
    return this.dateUtils.currentMemberBulkLoadDisplayDate();
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  createMemberFromAudit(memberFromAudit: Member) {
    const member = this.memberDefaultsService.applyDefaultMailSettingsToMember(cloneDeep(memberFromAudit), this.systemConfig, this.mailMessagingConfig);
    this.modalService.show(MemberAdminModalComponent, {
      class: "modal-xl",
      show: true,
      initialState: {
        editMode: EditMode.ADD_NEW,
        member,
        members: this.members,
      }
    });
    this.notify.warning({
      title: "Recreating Member",
      message: "Note that clicking Save immediately on this member is likely to cause the same error to occur as was originally logged in the audit. Therefore make the necessary changes here to allow the member record to be saved successfully"
    });
  }

  showMemberUpdateAuditColumn(field: string) {
    return this.filters.memberUpdateAudit.sortField.startsWith(field);
  }

  showMembersUploadedColumn(field: string) {
    return this.filters.membersUploaded.sortField === field;
  }

  sortMemberUpdateAuditBy(field: string) {
    this.applySortTo(field, this.filters.memberUpdateAudit, this.memberUpdateAudits);
  }

  memberUpdateAuditSummary() {
    return this.auditSummaryFormatted(this.auditSummary());
  }

  toFontAwesomeIcon(status: string): FontAwesomeIcon {
    if (status === "cancelled") {
      return {icon: faBan, class: "red-icon"};
    }
    if (status === "created") {
      return {icon: faCirclePlus, class: "green-icon"};
    }
    if (status === "complete" || status === "summary") {
      return {icon: faCircleCheck, class: "green-icon"};
    }
    if (status === "success") {
      return {icon: faCircleCheck, class: "green-icon"};
    }
    if (status === "info") {
      return {icon: faCircleInfo, class: "blue-icon"};
    }
    if (status === "updated") {
      return {icon: faPencil, class: "green-icon"};
    }
    if (status === "error") {
      return {icon: faRemove, class: "red-icon"};
    }
    if (status === "skipped") {
      return {icon: faThumbsUp, class: "green-icon"};
    }
  }

  applySortTo(field: string, filterSource: MemberTableFilter | MemberUpdateAuditTableFilter, unfilteredList: any[]) {
    this.logger.debug("sorting by field", field, "current value of filterSource", filterSource);
    filterSource.sortField = field;
    filterSource.sortFunction = field;
    filterSource.reverseSort = !filterSource.reverseSort;
    filterSource.sortDirection = filterSource.reverseSort ? DESCENDING : ASCENDING;
    this.logger.debug("sorting by field", field, "new value of filterSource", filterSource);
    this.applyFilterToList(filterSource, unfilteredList);
  }

  applyFilterToList(filter: MemberTableFilter | MemberUpdateAuditTableFilter, unfilteredList: any[]) {
    this.notify.setBusy();
    const filteredResults = sortBy(this.searchFilterPipe.transform(unfilteredList, this.quickSearch), filter.sortField);
    filter.results = filter.reverseSort ? filteredResults.reverse() : filteredResults;
    this.notify.clearBusy();
  }

  refreshMemberUpdateAudit(): Promise<MemberUpdateAudit[]> {
    if (this.uploadSession && this.uploadSession.id) {
      const uploadSessionId = this.uploadSession.id;
      const criteria: any = {uploadSessionId};
      if (this.filters.memberUpdateAudit.query.status) {
        criteria.memberAction = this.filters.memberUpdateAudit.query.status;
      }
      this.logger.debug("querying member audit records with", criteria);
      return this.memberUpdateAuditService.all({criteria, sort: {updateTime: -1}}).then(memberUpdateAudits => {
        this.memberUpdateAudits = memberUpdateAudits;
        this.logger.debug("queried", memberUpdateAudits.length, "member update audit records:", memberUpdateAudits);
        this.filterLists();
        return this.memberUpdateAudits;
      });
    } else {
      this.memberUpdateAudits = [];
      this.logger.debug("no member audit records");
      return Promise.resolve(this.memberUpdateAudits);
    }
  }

  private updateTabHeadings() {
    this.auditTabHeading = this.memberUpdateAuditSummary();
    this.memberTabHeading = (this.filters.membersUploaded.results.length || 0) + " Members uploaded";
  }

  uploadSessionChanged() {
    this.notify.setBusy();
    this.notify.hide();
    this.logger.info("upload session:", this.uploadSession);
    this.refreshMemberUpdateAudit().then(() => this.notify.clearBusy());
  }

  sortMembersUploadedBy(field) {
    this.applySortTo(field, this.filters.membersUploaded, this.uploadSession.members);
  }

  refreshMemberBulkLoadAudit(): Promise<any> {
    return this.memberBulkLoadAuditService.all({
      sort: {createdDate: -1}
    }).then(uploadSessions => {
      this.logger.debug("refreshed", uploadSessions && uploadSessions.length, "upload sessions");
      this.memberBulkLoadAudits = uploadSessions;
      this.uploadSession = first(uploadSessions);
      this.filterLists();
      return true;
    });
  }

  auditSummary() {
    return groupBy(this.filters.memberUpdateAudit.results, auditItem => auditItem.memberAction || "unknown");
  }

  auditSummaryFormatted(auditSummary) {
    const total = reduce(auditSummary, (memo, value) => memo + value.length, 0);
    const summary = map(auditSummary, (items, key) => `${items.length}:${key}`).join(", ");
    return `${total} Member audits ${total ? `(${summary})` : ""}`;
  }

  async validateBulkUploadProcessing(apiResponse: MemberBulkLoadAuditApiResponse): Promise<boolean> {
    this.logger.debug("validateBulkUploadProcessing:this.uploadSession", apiResponse);
    if (apiResponse.error) {
      this.notify.error({title: "Bulk upload failed", message: apiResponse.error, continue: true});
      return false;
    } else {
      const summary = this.auditSummary();
      const summaryFormatted = this.auditSummaryFormatted(summary);
      this.logger.debug("summary", summary, "summaryFormatted", summaryFormatted);
      if (summary.error) {
        this.notify.error({
          title: "Bulk upload was not successful",
          message: `One or more errors occurred - ${summaryFormatted}. To see the details of these errors, click on the 'Upload History' tab, Choose Status 'Error' where you will be able to view the members that could not be imported`,
          continue: true
        });
        return false;
      } else {
        return true;
      }
    }
  }

  async sendSubscriptionUpdates(validationSuccessful: boolean) {
    if (validationSuccessful) {
      const groupMembers = (await this.memberService.all()).filter(this.memberService.filterFor.GROUP_MEMBERS);
      this.logger.info("about to update", this.systemConfig?.mailDefaults?.mailProvider, "mail lists for", this.stringUtils.pluraliseWithCount(groupMembers.length, "member"));
      switch (this.systemConfig?.mailDefaults?.mailProvider) {
        case MailProvider.BREVO:
          return this.mailListUpdaterService.updateMailLists(this.notify, groupMembers);
        case MailProvider.MAILCHIMP:
          return this.mailchimpListUpdaterService.updateMailchimpLists(this.notify, groupMembers);
        default:
          return Promise.resolve();
      }
    } else {
      return Promise.resolve();
    }

  }

  clearBusy() {
    this.notify.clearBusy();
  }

  bulkUploadRamblersDataStart(fileElement: HTMLInputElement) {
    fileElement.click();
  }
}
