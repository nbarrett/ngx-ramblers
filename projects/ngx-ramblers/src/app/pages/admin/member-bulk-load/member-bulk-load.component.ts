import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { faEnvelopesBulk, faSearch, faCloudArrowDown } from "@fortawesome/free-solid-svg-icons";
import { first } from "es-toolkit/compat";
import { isString } from "es-toolkit/compat";
import { groupBy } from "es-toolkit/compat";
import { map } from "es-toolkit/compat";
import { reduce } from "es-toolkit/compat";
import { sortBy } from "es-toolkit/compat";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  Member,
  MemberAction,
  MemberBulkLoadAudit,
  MemberBulkLoadAuditApiResponse,
  MemberUpdateAudit,
  RamblersMember,
  SessionStatus,
  StatusMessage
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
import { SalesforceConfig } from "../../../models/salesforce.model";
import { SalesforceConfigService } from "../../../services/salesforce/salesforce-config.service";
import { SalesforceSyncService } from "../../../services/salesforce/salesforce-sync.service";
import { MailMessagingConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { cloneDeep } from "es-toolkit/compat";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MemberDefaultsService } from "../../../services/member/member-defaults.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { NO_CHANGES_OR_DIFFERENCES } from "../../../models/ramblers-insight-hub";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DecimalPipe, JsonPipe, NgClass, NgStyle, TitleCasePipe } from "@angular/common";
import { StatusIconComponent } from "../status-icon";
import { FormsModule } from "@angular/forms";
import { LinkComponent } from "../../../link/link";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";

@Component({
  selector: "app-bulk-load",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <tabset class="custom-tabset">
              <tab [heading]="'Help'">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-white-background rounded">
                    <div class="row">
                      <div class="col-sm-3">
                        <div class="item-panel-heading">
                          <fa-icon [icon]="faEnvelopesBulk" class="fa-5x ramblers"></fa-icon>
                          <h5>Member bulk load</h5>
                        </div>
                      </div>
                      <div class="col-sm-9">
                        <ul class="list-arrow">
                          <b>The following data format is supported</b>
                          <li>Since September 2020, Ramblers have switched to Using <a
                            href="https://insight.ramblers.org.uk">InsightHub</a> for providing member data to
                            Membership
                            Secretaries. The format that is compatible with Member Admin is <a
                              href="https://insight.ramblers.org.uk/#/views/MembershipSecretariesV4-AZURE/FullList">Explore/Membership/Membership
                              Secretaries V4/FullList</a>.
                            The file that needs to be downloaded is named <b>Full List.xlsx</b></li>
                          <li> Click the <b>New Upload Tab</b> to continue.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab active heading="New Upload">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-white-background rounded">
                    <div class="row">
                      <div class="col-md-12">
                        <ul class="list-arrow ms-0">
                          <b>To load the members, follow these steps:</b>
                          <li>Download the <a
                            href="https://insight.ramblers.org.uk/#/views/MembershipSecretariesV4-AZURE/FullList">Explore/Membership/Membership
                            Secretaries V4/FullList</a> from <a
                            href="https://insight.ramblers.org.uk">InsightHub</a> to a folder on your computer.
                          </li>
                          <li>Click the <b>Browse for member import file</b> button below, then navigate to the
                            downloaded file and then click <b>Open</b>. Alternatively you can drop the file on the <i>Or
                              drop file here</i> zone.
                          </li>
                          <li>The data will be loaded automatically. If the member does not match an existing member
                            based
                            on their membership number, a new member will be created with the
                            following fields populated: membership number,
                            forename, surname, postcode, private email, telephone, expiry date.
                          </li>
                          <li>If the member does match based on the membership number, the expiry date will be
                            updated.
                            Other fields will only be updated if they are blank.
                          </li>
                          <li>If all updates are performed
                            successfully, {{ systemConfig?.mailDefaults?.mailProvider | titlecase }} mailing list
                            updates will be performed automatically.
                          </li>
                          <li>If one or more errors occur during the Bulk Load, you can see the details of these
                            errors
                            by clicking on the <b>Upload History</b> tab, Choose Status 'Error' where you will be able
                            to view the members that could not be imported.
                          </li>
                        </ul>
                      </div>
                      <div class="col-md-4">
                        <input type="submit" [disabled]="notifyTarget.busy"
                               value="Browse for member import file"
                               (click)="bulkUploadRamblersDataStart(fileElement)"
                               class="btn btn-primary w-100"
                               [disabled]="notifyTarget.busy">
                        <input #fileElement class="d-none" id="browse-to-file" name="bulkUploadRamblersDataFile"
                               type="file" value="Upload"
                               ng2FileSelect [uploader]="fileUploader">
                        <div ng2FileDrop [ngClass]="{'file-over': hasFileOver}"
                             (fileOver)="fileOver($event)"
                             [uploader]="fileUploader"
                             class="drop-zone">
                          Or drop file here
                        </div>
                      </div>
                      <div class="col-md-8">
                        <table class="table">
                          <thead>
                          <tr>
                            <th width="50%">Name</th>
                            <th>Size</th>
                            <th>Progress</th>
                            <th>Uploaded</th>
                          </tr>
                          </thead>
                          <tbody>
                            @for (item of fileUploader.queue; track item._file) {
                              <tr>
                                <td><strong>{{ item?.file?.name }}</strong></td>
                                @if (fileUploader.options.isHTML5) {
                                  <td class="nowrap">{{ item?.file?.size / 1024 / 1024 | number:'.2' }}MB
                                  </td>
                                }
                                @if (fileUploader.options.isHTML5) {
                                  <td>
                                    <div class="progress" style="margin-bottom: 0;">
                                      <div class="progress-bar" role="progressbar"
                                           [ngStyle]="{ 'width': item.progress + '%' }"></div>
                                    </div>
                                  </td>
                                }
                                <td class="text-center">
                                  <app-status-icon
                                    [status]="item.isSuccess ? 'success' : item.isError ? 'error' : item.isCancel?'cancelled':'info'"/>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                    @if (notifyTarget.showAlert) {
                      <div class="row">
                        <div class="col-sm-12">
                          <div class="form-group">
                            <div class="alert {{notifyTarget.alertClass}}">
                              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                              @if (notifyTarget.alertTitle) {
                                <strong> {{ notifyTarget.alertTitle }}: </strong>
                              }
                              {{ notifyTarget.alertMessage }}
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </tab>
              @if (salesforceConfig?.enabled) {
                <tab heading="Sync from Salesforce">
                  <div class="admin-frame round-except-top-left">
                    <div class="admin-header-white-background rounded">
                      <div class="row">
                        <div class="col-md-12">
                          <p class="form-text text-muted">
                            Pulls member data straight from the Salesforce member API instead of an Insight Hub
                            xlsx upload. The xlsx route on the New Upload tab still works and can be run alongside
                            this; whichever sync runs last wins on overlapping records.
                          </p>
                          <ul class="list-arrow ms-0">
                            <li><b>Incremental sync</b> uses the cursor recorded after the last successful run. Pick this for routine refreshes.</li>
                            <li><b>Full sync</b> ignores the cursor and re-fetches the full member list. Use after a config change or when the cursor is suspect.</li>
                          </ul>
                          <button type="button"
                                  class="btn btn-primary me-2"
                                  [disabled]="salesforceSyncing"
                                  (click)="triggerSalesforceSync(false)">
                            <fa-icon [icon]="faCloudArrowDown" class="me-2"/>
                            {{ salesforceSyncing && !lastSalesforceFullSync ? "Syncing..." : "Sync now (incremental)" }}
                          </button>
                          <button type="button"
                                  class="btn btn-warning"
                                  [disabled]="salesforceSyncing"
                                  (click)="triggerSalesforceSync(true)">
                            <fa-icon [icon]="faCloudArrowDown" class="me-2"/>
                            {{ salesforceSyncing && lastSalesforceFullSync ? "Syncing..." : "Full sync" }}
                          </button>
                        </div>
                      </div>
                      @if (salesforceConfig?.lastSyncedAt) {
                        <div class="row mt-3">
                          <div class="col-md-12">
                            <strong>Last Salesforce sync:</strong>
                            {{ salesforceConfig.lastSyncedAt | displayDateAndTime }}
                            @if (salesforceConfig.lastSyncCursor) {
                              <span class="text-muted ms-2">cursor: {{ salesforceConfig.lastSyncCursor | displayDateAndTime }}</span>
                            }
                          </div>
                        </div>
                      }
                      @if (notifyTarget.showAlert) {
                        <div class="row mt-3">
                          <div class="col-md-12">
                            <div class="alert {{notifyTarget.alertClass}}">
                              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                              @if (notifyTarget.alertTitle) {
                                <strong> {{ notifyTarget.alertTitle }}: </strong>
                              }
                              {{ notifyTarget.alertMessage }}
                            </div>
                          </div>
                        </div>
                      }
                      @if (salesforceSyncAuditLog.length > 0) {
                        <div class="table-responsive mt-3">
                          <table class="round tbl-green-g table-striped table-hover table-sm">
                            <thead>
                            <tr class="pointer">
                              <th>Status</th>
                              <th>Message</th>
                            </tr>
                            </thead>
                            <tbody>
                              @for (auditLog of salesforceSyncAuditLog; track auditLog.message) {
                                <tr>
                                  <td>
                                    <app-status-icon [status]="auditLog.status"/>
                                  </td>
                                  <td>{{ auditLog.message }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </div>
                  </div>
                </tab>
              }
              <tab heading="Upload History">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-background rounded">
                    <div class="admin-header-container-with-tabs">
                      @if (memberBulkLoadAudits.length == 0) {
                        <div class="admin-session-loading">
                          <div class="col-sm-12 text-center mt-3">
                            <h3>No Upload History Exists</h3>
                          </div>
                        </div>
                      }
                      @if (uploadSession) {
                        <div class="row quick-search d-flex align-items-end flex-nowrap">
                          <div class="col">
                            <div class="input-group">
                              <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                              <input id="quick-search" [(ngModel)]="quickSearch"
                                     (ngModelChange)="onSearchChange($event)"
                                     name="quickSearch"
                                     class="form-control input-sm rounded"
                                     type="text" placeholder="Quick Search">
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="input-group">
                              <label class="input-group-text" for="filter-upload-sessions">Uploaded at:</label>
                              <select class="form-control input-sm" id="filter-upload-sessions"
                                      [(ngModel)]="uploadSession"
                                      (ngModelChange)="uploadSessionChanged()">
                                @for (uploadSession of memberBulkLoadAudits; track uploadSession.id) {
                                  <option
                                    [ngValue]="uploadSession">{{ uploadSession.createdDate | displayDateAndTime }}
                                  </option>
                                }
                              </select>
                            </div>
                          </div>
                          <div class="col-auto ms-auto">
                            <div class="input-group">
                              <label class="input-group-text" for="filter-by-audit-status">Member Action:</label>
                              <select class="form-control input-sm"
                                      [(ngModel)]="filters.memberUpdateAudit.query"
                                      (ngModelChange)="uploadSessionChanged()"
                                      id="filter-by-audit-status">
                                @for (uploadSessionStatus of uploadSessionStatuses; track uploadSessionStatus.title) {
                                  <option
                                    [ngValue]="uploadSessionStatus">{{ uploadSessionStatus.title }}
                                  </option>
                                }
                              </select>
                            </div>
                          </div>
                        </div>
                      }
                      @if (uploadSession) {
                        <tabset class="custom-tabset">
                          <tab [heading]="memberTabHeading" class="table-responsive">
                            <table class="round tbl-green-g table-striped table-hover table-sm">
                              <thead>
                              <tr class="pointer">
                                <th colspan="2">File upload information</th>
                              </tr>
                              </thead>
                              <tbody>
                                @if (uploadSession?.files?.archive) {
                                  <tr>
                                    <td>Zip file:</td>
                                    <td>
                                      <app-link
                                        name="{{uploadSession.files?.archive}}"/>
                                    </td>
                                  </tr>
                                }
                                @if (uploadSession?.files?.data) {
                                  <tr>
                                    <td>Data file:</td>
                                    <td>
                                      <app-link [name]="uploadSession?.files?.data"/>
                                    </td>
                                  </tr>
                                }
                              <tr>
                                <td>Uploaded by:</td>
                                <td>{{ uploadSession.createdBy | memberIdToFullName : members : '(none)' }}</td>
                              </tr>
                              <tr>
                                <td>Uploaded on:</td>
                                <td>{{ uploadSession.createdDate | displayDateAndTime }}</td>
                              </tr>
                              </tbody>
                            </table>
                            <div class="table-responsive">
                              <table class="round tbl-green-g table-striped table-hover table-sm">
                                <thead>
                                <tr class="pointer">
                                  <th>Status</th>
                                  <th>Message</th>
                                </tr>
                                </thead>
                                <tbody>
                                  @for (auditLog of uploadSession.auditLog; track auditLog.message) {
                                    <tr>
                                      <td>
                                        <app-status-icon [status]="auditLog.status"/>
                                      </td>
                                      <td>{{ auditLog.message }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                            <div class="table-responsive">
                              <table class="round tbl-green-g table-striped table-hover table-sm">
                                <thead>
                                <tr class="pointer">
                                  <th>
                                    <div (click)="sortMembersUploadedBy('membershipNumber')">Membership
                                      Number
                                      @if (showMembersUploadedColumn('membershipNumber')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                  <th>
                                    <div (click)="sortMembersUploadedBy('mobileNumber')">Mobile Number
                                      @if (showMembersUploadedColumn('mobileNumber')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                  <th>
                                    <div (click)="sortMembersUploadedBy('email')">Email
                                      @if (showMembersUploadedColumn('email')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                  <th>
                                    <div (click)="sortMembersUploadedBy('firstName')">First Name
                                      @if (showMembersUploadedColumn('firstName')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                  <th>
                                    <div (click)="sortMembersUploadedBy('lastName')">Last Number
                                      @if (showMembersUploadedColumn('lastName')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                  <th>
                                    <div (click)="sortMembersUploadedBy('postcode')">Postcode
                                      @if (showMembersUploadedColumn('postcode')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </div>
                                  </th>
                                </tr>
                                </thead>
                                <tbody>
                                  @for (member of filters.membersUploaded.results; track member.id) {
                                    <tr>
                                      <td>{{ member.membershipNumber }}</td>
                                      <td>{{ member.mobileNumber }}</td>
                                      <td>{{ member.email }}</td>
                                      <td>{{ member.firstName }}</td>
                                      <td>{{ member.lastName }}</td>
                                      <td>{{ member.postcode }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          </tab>
                          <tab [heading]="auditTabHeading" class="table-responsive">
                            <table class="round tbl-green-g table-striped table-hover table-sm">
                              <thead>
                              <tr class="pointer">
                                <th>
                                  <div (click)="sortMemberUpdateAuditBy('updateTime')">Update Time
                                    @if (showMemberUpdateAuditColumn('updateTime')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                                <th width="10%">
                                  <div (click)="sortMemberUpdateAuditBy('memberAction')">Status
                                    @if (showMemberUpdateAuditColumn('memberAction')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                                <th>
                                  <div (click)="sortMemberUpdateAuditBy('rowNumber')">Row Number
                                    @if (showMemberUpdateAuditColumn('rowNumber')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                                <th>
                                  <div
                                    (click)="sortMemberUpdateAuditBy('member')">Member Name
                                    @if (showMemberUpdateAuditColumn('member')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                                <th>
                                  <div (click)="sortMemberUpdateAuditBy('changes')"> Changes
                                    @if (showMemberUpdateAuditColumn('changes')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                                <th>
                                  <div (click)="sortMemberUpdateAuditBy('auditMessage')">Audit Message
                                    @if (showMemberUpdateAuditColumn('auditMessage')) {
                                      <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                    }
                                  </div>
                                </th>
                              </tr>
                              </thead>
                              <tbody>
                                @for (memberUpdateAudit of filters.memberUpdateAudit.results; track memberUpdateAudit.id) {
                                  <tr>
                                    <td class="text-nowrap">{{ memberUpdateAudit.updateTime | displayDateAndTime }}
                                    </td>
                                    <td class="text-nowrap">
                                      <app-status-icon [status]="memberUpdateAudit.memberAction"/>
                                    </td>
                                    <td>{{ memberUpdateAudit.rowNumber }}</td>
                                    <td>{{ memberUpdateAudit.memberId || (memberUpdateAudit.member && memberUpdateAudit.member.id) | memberIdToFullName : members : '': true }}</td>
                                    <td>{{ memberUpdateAudit.changes }}</td>
                                    <td>{{ memberUpdateAudit.auditMessage || NO_CHANGES_OR_DIFFERENCES }}
                                      @if (memberUpdateAudit.auditErrorMessage) {
                                        <span>
                                    <strong>Error Message: </strong>
                                    <span>{{ memberUpdateAudit.auditErrorMessage | json }}</span>
                                    <br>
                                      <input type="submit" [disabled]="notifyTarget.busy"
                                             class="btn btn-primary"
                                             value="Reattempt creation of {{memberUpdateAudit.member | fullName}}"
                                             (click)="createMemberFromAudit(memberUpdateAudit.member)"
                                             title="Reattempt creation of {{memberUpdateAudit.member | fullName}}">
                                    </span>
                                      }
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </tab>
                        </tabset>
                      }
                    </div>
                  </div>
                </div>
              </tab>
            </tabset>
          </div>
        </div>
      </div>
    </app-page>`,
  styleUrls: ["./member-bulk-load.component.sass", "../admin/admin.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, FontAwesomeModule, FileUploadModule, NgClass, NgStyle, StatusIconComponent, FormsModule, LinkComponent, JsonPipe, DecimalPipe, TitleCasePipe, DisplayDateAndTimePipe, FullNamePipe, MemberIdToFullNamePipe]
})
export class MemberBulkLoadComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MemberBulkLoadComponent", NgxLoggerLevel.ERROR);
  private mailchimpListUpdaterService = inject(MailchimpListUpdaterService);
  mailMessagingService = inject(MailMessagingService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private memberBulkLoadService = inject(MemberBulkLoadService);
  private memberService = inject(MemberService);
  private searchFilterPipe = inject(SearchFilterPipe);
  protected icons = inject(IconService);
  private memberUpdateAuditService = inject(MemberUpdateAuditService);
  private memberDefaultsService = inject(MemberDefaultsService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private modalService = inject(BsModalService);
  protected stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private searchChangeObservable: Subject<string>;
  public uploadSessionStatuses: SessionStatus[] = [
    {title: "All"},
    {status: MemberAction.created, title: "Created"},
    {status: MemberAction.skipped, title: "Skipped"},
    {status: MemberAction.updated, title: "Updated"},
    {status: MemberAction.error, title: "Error"}];
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
  private salesforceConfigService = inject(SalesforceConfigService);
  private salesforceSyncService = inject(SalesforceSyncService);
  private subscriptions: Subscription[] = [];
  faEnvelopesBulk = faEnvelopesBulk;
  faSearch = faSearch;
  faCloudArrowDown = faCloudArrowDown;
  salesforceConfig: SalesforceConfig | null = null;
  salesforceSyncing = false;
  lastSalesforceFullSync = false;
  salesforceSyncAuditLog: StatusMessage[] = [];
  protected readonly NO_CHANGES_OR_DIFFERENCES = NO_CHANGES_OR_DIFFERENCES;

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
    this.subscriptions.push(this.salesforceConfigService.events().subscribe(salesforceConfig => {
      this.logger.info("subscribing to salesforceConfigService events:", salesforceConfig);
      this.salesforceConfig = salesforceConfig;
    }));
    this.salesforceConfigService.refresh();
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
      this.logger.info("response", response, "type", typeof response);
      if (response instanceof HttpErrorResponse) {
        this.notify.error({title: "Upload failed", message: response.error});
      } else if (response === "Unauthorized") {
        this.notify.error({
          title: "Upload failed",
          message: `${response} - try logging out and logging back in again and trying this again.`
        });
      } else {
        const memberBulkLoadAuditApiResponse: MemberBulkLoadAuditApiResponse = JSON.parse(response);
        this.logger.info("received response", memberBulkLoadAuditApiResponse);
        const memberBulkLoadResponse = memberBulkLoadAuditApiResponse.response as MemberBulkLoadAudit;
        this.memberBulkLoadService.processResponse(this.mailMessagingConfig, this.systemConfig, memberBulkLoadResponse, this.members, this.notify)
          .then(() => this.refreshMemberBulkLoadAudit())
          .then(() => this.refreshMemberUpdateAudit())
          .then(() => this.validateBulkUploadProcessing(memberBulkLoadAuditApiResponse))
          .then((validationSuccessful) => this.sendSubscriptionUpdates(validationSuccessful))
          .finally(async () => {
            await this.refreshMembers();
            this.clearBusy();
          });
      }
    }));

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
    void this.refreshMembers();
    this.memberBulkLoadAuditService.all({
      sort: {createdDate: -1}
    }).then(memberBulkLoadAudits => {
      this.logger.debug("found", this.stringUtils.pluraliseWithCount(memberBulkLoadAudits.length, "memberBulkLoadAudit"));
      this.memberBulkLoadAudits = memberBulkLoadAudits;
      this.uploadSession = first(this.memberBulkLoadAudits);
      this.uploadSessionChanged();
    });
  }

  private refreshMembers(): Promise<Member[]> {
    this.logger.info(`refreshing ${this.stringUtils.pluraliseWithCount(this.members.length, "member")}`);
    return this.memberService.all().then(members => {
      this.logger.info(`found ${this.stringUtils.pluraliseWithCount(members.length, "member")}`);
      this.members = members;
      return members;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async triggerSalesforceSync(fullSync: boolean) {
    if (this.salesforceSyncing) {
      return;
    }
    this.salesforceSyncing = true;
    this.lastSalesforceFullSync = fullSync;
    this.salesforceSyncAuditLog = [];
    this.notify.setBusy();
    try {
      const apiResponse = await this.salesforceSyncService.sync(fullSync);
      const audit = apiResponse?.response;
      this.salesforceSyncAuditLog = audit?.auditLog ?? [];
      if (apiResponse?.error) {
        this.notify.error({title: "Salesforce sync failed", message: this.salesforceErrorText(apiResponse.error)});
        if (audit) {
          await this.memberBulkLoadAuditService.create(audit).catch(error => {
            this.logger.error("audit-create-error", error);
          });
        }
        return;
      }
      if (!audit) {
        this.notify.error({title: "Salesforce sync failed", message: "Salesforce sync returned no result."});
        return;
      }
      const members = await this.refreshMembers();
      await this.memberBulkLoadService.processResponse(this.mailMessagingConfig, this.systemConfig, audit, members, this.notify);
      await this.refreshMemberBulkLoadAudit();
      await this.refreshMemberUpdateAudit();
      const validationSuccessful = await this.validateBulkUploadProcessing({action: null, request: null, response: audit});
      await this.sendSubscriptionUpdates(validationSuccessful);
      await this.refreshMembers();
      await this.salesforceConfigService.refresh();
    } catch (error) {
      this.logger.error("Salesforce sync error", error);
      this.notify.error({title: "Salesforce sync failed", message: error instanceof Error ? error.message : String(error)});
    } finally {
      this.salesforceSyncing = false;
      this.clearBusy();
    }
  }

  private salesforceErrorText(error: unknown): string {
    if (isString(error)) {
      return error;
    }
    const record = error as Record<string, string>;
    return record?.errorMessage || record?.message || record?.errorCode || JSON.stringify(error);
  }

  private filterLists(searchTerm?: string) {
    this.applyFilterToList(this.filters.membersUploaded, this.uploadSession.members);
    this.applyFilterToList(this.filters.memberUpdateAudit, this.memberUpdateAudits);
    this.updateTabHeadings();
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug(`received searchEntry:${searchEntry}`);
    this.searchChangeObservable.next(searchEntry);
  }

  async createMemberFromAudit(memberFromAudit: Member) {
    const members = await this.refreshMembers();
    const existingMatch = this.memberBulkLoadService.existingMemberMatchFor({
      ramblersMember: memberFromAudit as unknown as RamblersMember,
      contact: null
    }, members);
    const existingMember = existingMatch.member;
    const member = this.memberDefaultsService.applyDefaultMailSettingsToMember(cloneDeep(existingMember ?? memberFromAudit), this.systemConfig, this.mailMessagingConfig);
    this.modalService.show(MemberAdminModalComponent, {
      class: "modal-xl",
      show: true,
      initialState: {
        editMode: existingMember ? EditMode.EDIT : EditMode.ADD_NEW,
        member,
        members: this.members,
      }
    });
    if (existingMember) {
      this.notify.success({
        title: "Existing member found",
        message: `Opened the existing member matched by ${existingMatch.memberMatchType}. Saving will update that record instead of creating a duplicate.`
      });
    } else {
      this.notify.warning({
        title: "Recreating Member",
        message: "No existing member match was found. Review the details before saving this as a new member."
      });
    }
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
    this.memberTabHeading = `${this.filters.membersUploaded.results.length || 0} Members uploaded`;
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
    const summary = map(auditSummary, (items, key) => `${items.length}:${this.stringUtils.asTitle(key)}`).join(", ");
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

  async bulkUploadRamblersDataStart(fileElement: HTMLInputElement) {
    await this.refreshMembers();
    fileElement.click();
  }
}
