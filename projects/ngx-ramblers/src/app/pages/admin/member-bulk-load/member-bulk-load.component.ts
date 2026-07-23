import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { faEnvelopesBulk, faSearch, faCloudArrowDown, faTrash } from "@fortawesome/free-solid-svg-icons";
import { first, isNumber, isString, groupBy, map, max, min, reduce, sortBy, kebabCase, values } from "es-toolkit/compat";
import { extractErrorMessage } from "../../../functions/strings";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime } from "luxon";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
import { AdminSettingsPath } from "../../../models/admin-route-paths.model";
import { ALERT_WARNING, AlertTarget } from "../../../models/alert-target.model";
import { ExternalSystemsSubTab, SystemSettingsTab } from "../../../models/system.model";
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
import { UIDateFormat } from "../../../models/date-format.model";
import { EditMode, StoredValue } from "../../../models/ui-actions";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpListUpdaterService } from "../../../services/mailchimp/mailchimp-list-updater.service";
import { MemberBulkLoadAuditService } from "../../../services/member/member-bulk-load-audit.service";
import { MemberBulkLoadService } from "../../../services/member/member-bulk-load.service";
import { MemberUpdateAuditService } from "../../../services/member/member-update-audit.service";
import { MemberService } from "../../../services/member/member.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { MemberAdminModalComponent } from "../member-admin-modal/member-admin-modal.component";
import { SalesforceConfig, memberBulkLoadSourceLabel } from "../../../models/salesforce.model";
import { SalesforceConfigService } from "../../../services/salesforce/salesforce-config.service";
import { SalesforceSyncService } from "../../../services/salesforce/salesforce-sync.service";
import { MailMessagingConfig } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { cloneDeep } from "es-toolkit/compat";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MemberDefaultsService } from "../../../services/member/member-defaults.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DecimalPipe, NgClass, TitleCasePipe } from "@angular/common";
import { StatusIconComponent } from "../status-icon";
import { FormsModule } from "@angular/forms";
import { LinkComponent } from "../../../link/link";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { DateRange, DateRangeSlider } from "../../../components/date-range-slider/date-range-slider";

export enum MemberBulkLoadTab {
  INSIGHT_HUB_IMPORT = "Insight Hub Import",
  RAMBLERS_TEAM_EMAILS = "Ramblers Team Emails",
  UPLOAD_HISTORY = "Upload History",
  MANAGE_HISTORY = "Manage History",
  MEMBER_SYNC_NOTIFICATIONS = "Member Sync Notifications",
}

export enum LegacyMemberBulkLoadTabSlug {
  NEW_UPLOAD = "new-upload",
  HELP = "help",
  SYNC_FROM_SALESFORCE = "sync-from-salesforce",
  SALESFORCE = "salesforce",
  HEAD_OFFICE_SUPPORTER_IMPORT = "head-office-supporter-import",
  SYNC_NOTIFICATIONS = "sync-notifications",
}

export enum MemberBulkLoadHistoryPreset {
  CUSTOM = "custom",
  LAST_7_DAYS = "last-7-days",
  LAST_30_DAYS = "last-30-days",
  LAST_90_DAYS = "last-90-days",
  LAST_1_YEAR = "last-1-year",
  OLDER_THAN_1_YEAR = "older-than-1-year",
  ALL_SESSIONS = "all-sessions",
}

export enum MemberBulkLoadSubTab {
  MEMBERS_UPLOADED = "Members Uploaded",
  MEMBER_ACTIONS = "Member Actions",
}

@Component({
  selector: "app-bulk-load",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <tabset class="custom-tabset">
              <tab [heading]="MemberBulkLoadTab.INSIGHT_HUB_IMPORT"
                   [active]="tabActive(MemberBulkLoadTab.INSIGHT_HUB_IMPORT)"
                   (selectTab)="selectTab(MemberBulkLoadTab.INSIGHT_HUB_IMPORT)">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-white-background rounded">
                    <div class="row">
                      <div class="col-sm-3">
                        <div class="item-panel-heading">
                          <fa-icon [icon]="faEnvelopesBulk" class="fa-5x ramblers"></fa-icon>
                          <h5>Insight Hub import</h5>
                        </div>
                      </div>
                      <div class="col-sm-9">
                        <ul class="list-arrow">
                          <b>The following data format is supported</b>
                          <li>Since September 2020, Ramblers have used <a
                            href="https://insight.ramblers.org.uk">InsightHub</a> to provide member data to
                            Membership Secretaries. The format compatible with Member Admin is
                            <a href="https://insight.ramblers.org.uk/#/views/MembershipSecretariesV4-AZURE/FullList">Explore/Membership/Membership
                              Secretaries V4/FullList</a>.
                            Download the file named <b>Full List.xlsx</b>.
                          </li>
                          <li>Click <b>Browse for member import file</b> below, choose the downloaded file and click
                            <b>Open</b>, or drop the file on the <i>Or drop file here</i> zone.
                          </li>
                          <li>The data is loaded automatically. If a row does not match an existing member by membership
                            number, a new member is created with membership number, forename, surname, postcode, private
                            email, telephone and expiry date populated.
                          </li>
                          <li>If the member matches by membership number, the expiry date is updated. Other fields are
                            only updated when they are blank.
                          </li>
                          <li>If all updates succeed, {{ systemConfig?.mailDefaults?.mailProvider | titlecase }} mailing
                            list updates run automatically.
                          </li>
                          <li>If one or more errors occur, open the
                            <a href="#" (click)="$event.preventDefault(); selectTab(MemberBulkLoadTab.UPLOAD_HISTORY)">Upload History</a>
                            tab and choose Status <b>Error</b> to review members that could not be imported.
                          </li>
                        </ul>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                          <button type="button"
                                  class="btn btn-primary flex-shrink-0"
                                  [disabled]="notifyTarget.busy"
                                  (click)="bulkUploadRamblersDataStart(fileElement)">
                            <fa-icon [icon]="faEnvelopesBulk" class="me-2"/>
                            Browse for member import file
                          </button>
                          <input #fileElement class="d-none" id="browse-to-file" name="bulkUploadRamblersDataFile"
                                 type="file" value="Upload"
                                 ng2FileSelect [uploader]="fileUploader">
                          <div ng2FileDrop [ngClass]="{'file-over': hasFileOver}"
                               (fileOver)="fileOver($event)"
                               [uploader]="fileUploader"
                               class="drop-zone flex-grow-1 mb-0">
                            Or drop file here
                          </div>
                        </div>
                        @if (currentUploadItem(); as item) {
                          <p class="form-text mt-3 mb-0">
                            <strong>{{ item.file?.name }}</strong>
                            @if (item.file?.size) {
                              <span class="text-muted"> ({{ item.file.size / 1024 / 1024 | number:".2" }} MB)</span>
                            }
                            <br>
                            @if (item.isSuccess) {
                              Uploaded successfully.
                            } @else if (item.isError) {
                              Upload failed.
                            } @else if (item.isCancel) {
                              Upload cancelled.
                            } @else if (item.progress > 0) {
                              Uploading… {{ item.progress }}%
                            } @else {
                              Preparing upload…
                            }
                          </p>
                        }
                      </div>
                    </div>
                    @if (notifyTarget.showAlert) {
                      <div class="row mt-3">
                        <div class="col-sm-12">
                          <div class="alert {{notifyTarget.alertClass}} mb-0">
                            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                            @if (notifyTarget.alertTitle) {
                              <strong> {{ notifyTarget.alertTitle }}: </strong>
                            }
                            {{ notifyTarget.alertMessage }}
                          </div>
                          @if (notifyTarget.showProgress) {
                            <div class="progress mt-2" style="height: 24px;">
                              <div class="progress-bar progress-bar-striped progress-bar-animated"
                                   role="progressbar"
                                   [style.width.%]="notifyTarget.progressPercent || 0"
                                   [attr.aria-valuenow]="notifyTarget.progressPercent || 0"
                                   aria-valuemin="0"
                                   aria-valuemax="100">
                                @if (notifyTarget.progressPercent) {
                                  {{ notifyTarget.progressPercent }}%
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </tab>
              <tab [heading]="MemberBulkLoadTab.RAMBLERS_TEAM_EMAILS"
                   [active]="tabActive(MemberBulkLoadTab.RAMBLERS_TEAM_EMAILS)"
                   (selectTab)="selectTab(MemberBulkLoadTab.RAMBLERS_TEAM_EMAILS)">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-white-background rounded">
                    <div class="row">
                      <div class="col-sm-3">
                        <div class="item-panel-heading">
                          <fa-icon [icon]="faCloudArrowDown" class="fa-5x ramblers"></fa-icon>
                          <h5>Ramblers Team Emails</h5>
                        </div>
                      </div>
                      <div class="col-sm-9">
                        @if (salesforceConfig?.enabled) {
                          <ul class="list-arrow">
                            <b>How supporter sync works</b>
                            <li>Pulls the current supporter snapshot from Ramblers Team Emails for each configured
                              team code and reconciles it into Member Admin. This is a full snapshot each time, not an
                              incremental change feed.
                            </li>
                            <li>Matches supporters by member reference, contact ID, membership number and email.</li>
                            <li>Supports members, volunteers, Wellbeing Walkers and contacts without membership numbers.</li>
                            <li>Keeps local-only fields the API does not return. Supporters missing from this snapshot are not prepared for apply (they still show as not received in the last bulk load).</li>
                            <li>Results are recorded in
                              <a href="#" (click)="$event.preventDefault(); selectTab(MemberBulkLoadTab.UPLOAD_HISTORY)">Upload History</a>
                              for inspection after the run.
                            </li>
                          </ul>
                          <button type="button"
                                  class="btn btn-primary mt-2"
                                  [disabled]="salesforceSyncing"
                                  (click)="triggerSalesforceSync()">
                            <fa-icon [icon]="faCloudArrowDown" class="me-2"/>
                            {{ salesforceSyncing ? "Syncing..." : "Sync supporters now" }}
                          </button>
                          @if (salesforceConfig?.lastSyncedAt) {
                            <p class="form-text mt-3 mb-0">
                              <strong>Last supporter sync:</strong>
                              {{ salesforceConfig.lastSyncedAt | displayDateAndTime }}
                            </p>
                          }
                        } @else {
                          <ul class="list-arrow">
                            <b>Not enabled yet</b>
                            <li>Ramblers Team Emails is turned off for this site, so supporter sync is not available.</li>
                            <li>Enable it under
                              <a [routerLink]="'/' + adminSettingsSystemSettingsPath"
                                 [queryParams]="salesforceSettingsQueryParams">System Settings → External Systems → Ramblers Team Emails</a>.
                            </li>
                          </ul>
                        }
                      </div>
                    </div>
                    @if (salesforceConfig?.enabled && notifyTarget.showAlert) {
                      <div class="row mt-3">
                        <div class="col-sm-12">
                          <div class="alert {{notifyTarget.alertClass}} mb-0">
                            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                            @if (notifyTarget.alertTitle) {
                              <strong> {{ notifyTarget.alertTitle }}: </strong>
                            }
                            {{ notifyTarget.alertMessage }}
                          </div>
                          @if (notifyTarget.showProgress) {
                            <div class="progress mt-2" style="height: 24px;">
                              <div class="progress-bar progress-bar-striped progress-bar-animated"
                                   role="progressbar"
                                   [style.width.%]="notifyTarget.progressPercent || 0"
                                   [attr.aria-valuenow]="notifyTarget.progressPercent || 0"
                                   aria-valuemin="0"
                                   aria-valuemax="100">
                                @if (notifyTarget.progressPercent) {
                                  {{ notifyTarget.progressPercent }}%
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                    @if (salesforceConfig?.enabled && salesforceSyncAuditLog.length > 0) {
                      <div class="bulk-load-viewport-panel mt-3">
                        <div class="ngx-data-table-card mb-0">
                          <table class="ngx-data-table">
                            <thead>
                            <tr>
                              <th class="text-nowrap">Status</th>
                              <th>Message</th>
                            </tr>
                            </thead>
                            <tbody>
                              @for (auditLog of salesforceSyncAuditLog; track auditLog.message) {
                                <tr>
                                  <td class="text-nowrap">
                                    <app-status-icon [status]="auditLog.status"/>
                                  </td>
                                  <td class="audit-message">{{ auditLog.message }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </tab>
              <tab [heading]="MemberBulkLoadTab.UPLOAD_HISTORY"
                   [active]="tabActive(MemberBulkLoadTab.UPLOAD_HISTORY)"
                   (selectTab)="selectTab(MemberBulkLoadTab.UPLOAD_HISTORY)">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-background rounded">
                    <div class="admin-header-container-with-tabs">
                      @if (!uploadHistoryLoaded) {
                        <div class="admin-session-loading">
                          <div class="col-sm-12 text-center mt-3">
                            <div class="spinner-border text-primary" role="status">
                              <span class="visually-hidden">Loading upload history...</span>
                            </div>
                            <div class="mt-2 text-muted">Loading upload history...</div>
                          </div>
                        </div>
                      } @else if (memberBulkLoadAudits.length === 0) {
                        <div class="admin-session-loading">
                          <div class="col-sm-12 text-center mt-3">
                            <h3>No Upload History Exists</h3>
                          </div>
                        </div>
                      }
                      @if (uploadHistoryLoaded && uploadSession) {
                        <div class="custom-tabset bulk-load-viewport-panel">
                          <div class="rsm-toolbar mb-3">
                            <div class="rsm-toolbar-grow">
                              <div class="input-group">
                                <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                                <input id="quick-search" [(ngModel)]="quickSearch"
                                       (ngModelChange)="onSearchChange($event)"
                                       name="quickSearch"
                                       class="form-control"
                                       type="text" placeholder="Quick Search">
                              </div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                              <label class="form-label mb-0 text-muted text-nowrap" for="filter-upload-sessions">Uploaded at</label>
                              <select class="form-control" id="filter-upload-sessions"
                                      [(ngModel)]="uploadSession"
                                      (ngModelChange)="uploadSessionChanged()">
                                @for (session of memberBulkLoadAudits; track session.id) {
                                  <option [ngValue]="session">{{ session.createdDate | displayDateAndTime }}</option>
                                }
                              </select>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                              <label class="form-label mb-0 text-muted text-nowrap" for="filter-by-audit-status">Member Action</label>
                              <select class="form-control"
                                      [(ngModel)]="filters.memberUpdateAudit.query"
                                      (ngModelChange)="uploadSessionChanged()"
                                      id="filter-by-audit-status">
                                @for (uploadSessionStatus of uploadSessionStatuses; track uploadSessionStatus.title) {
                                  <option [ngValue]="uploadSessionStatus">{{ uploadSessionStatus.title }}</option>
                                }
                              </select>
                            </div>
                          </div>
                          <tabset class="upload-history-subtabs">
                          <tab [heading]="memberTabHeading"
                               [active]="subTabActive(MemberBulkLoadSubTab.MEMBERS_UPLOADED)"
                               (selectTab)="selectSubTab(MemberBulkLoadSubTab.MEMBERS_UPLOADED)">
                            <div class="bulk-load-panel-scroll">
                            <div class="ngx-data-table-card mb-3">
                              <table class="ngx-data-table">
                                <thead>
                                <tr>
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
                            </div>
                            <div class="ngx-data-table-card mb-3">
                              <table class="ngx-data-table">
                                <thead>
                                <tr>
                                  <th class="text-nowrap">Status</th>
                                  <th>Message</th>
                                </tr>
                                </thead>
                                <tbody>
                                  @for (auditLog of uploadSession.auditLog; track auditLog.message) {
                                    <tr>
                                      <td class="text-nowrap">
                                        <app-status-icon [status]="auditLog.status"/>
                                      </td>
                                      <td class="audit-message">{{ auditLog.message }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                            <div class="ngx-data-table-card mb-0">
                              <div class="table-responsive">
                                <table class="ngx-data-table">
                                  <thead>
                                  <tr>
                                    <th class="sortable" (click)="sortMembersUploadedBy('membershipNumber')">Membership
                                      Number
                                      @if (showMembersUploadedColumn('membershipNumber')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMembersUploadedBy('mobileNumber')">Mobile Number
                                      @if (showMembersUploadedColumn('mobileNumber')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMembersUploadedBy('email')">Email
                                      @if (showMembersUploadedColumn('email')) {
                                        <span
                                          class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMembersUploadedBy('firstName')">First Name
                                      @if (showMembersUploadedColumn('firstName')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMembersUploadedBy('lastName')">Last Name
                                      @if (showMembersUploadedColumn('lastName')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMembersUploadedBy('postcode')">Postcode
                                      @if (showMembersUploadedColumn('postcode')) {
                                        <span class="sorting-header">{{ filters.membersUploaded.sortDirection }}</span>
                                      }
                                    </th>
                                  </tr>
                                  </thead>
                                  <tbody>
                                    @for (member of filters.membersUploaded.results; track memberTrack(member, $index)) {
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
                            </div>
                            </div>
                          </tab>
                          <tab [heading]="auditTabHeading"
                               [active]="subTabActive(MemberBulkLoadSubTab.MEMBER_ACTIONS)"
                               (selectTab)="selectSubTab(MemberBulkLoadSubTab.MEMBER_ACTIONS)">
                            <div class="bulk-load-panel-scroll">
                            <div class="ngx-data-table-card mb-0">
                              <div class="table-responsive">
                                <table class="ngx-data-table">
                                  <thead>
                                  <tr>
                                    <th class="sortable" (click)="sortMemberUpdateAuditBy('updateTime')">Update Time
                                      @if (showMemberUpdateAuditColumn('updateTime')) {
                                        <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" width="10%" (click)="sortMemberUpdateAuditBy('memberAction')">Status
                                      @if (showMemberUpdateAuditColumn('memberAction')) {
                                        <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMemberUpdateAuditBy('rowNumber')">Row Number
                                      @if (showMemberUpdateAuditColumn('rowNumber')) {
                                        <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMemberUpdateAuditBy('member')">Member Name
                                      @if (showMemberUpdateAuditColumn('member')) {
                                        <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                      }
                                    </th>
                                    <th class="sortable" (click)="sortMemberUpdateAuditBy('changes')">Changes
                                      @if (showMemberUpdateAuditColumn('changes')) {
                                        <span class="sorting-header">{{ filters.memberUpdateAudit.sortDirection }}</span>
                                      }
                                    </th>
                                    <th>Fields Changed</th>
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
                                    <td>
                                      @if (auditChangeSummary(memberUpdateAudit)) {
                                        <div>{{ auditChangeSummary(memberUpdateAudit) }}</div>
                                      }
                                      @if (memberUpdateAudit.auditErrorMessage) {
                                        <div class="mt-1">
                                          <strong>Save failed: </strong>
                                          <span>{{ auditErrorText(memberUpdateAudit) }}</span>
                                        </div>
                                        <input type="submit" [disabled]="notifyTarget.busy"
                                               class="btn btn-primary mt-2"
                                               value="Review {{ memberUpdateAudit.member | fullName }}"
                                               (click)="createMemberFromAudit(memberUpdateAudit.member)"
                                               title="Open this member to review or save">
                                      }
                                    </td>
                                  </tr>
                                }
                              </tbody>
                                </table>
                              </div>
                            </div>
                            </div>
                          </tab>
                          </tabset>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="MemberBulkLoadTab.MANAGE_HISTORY"
                   [active]="tabActive(MemberBulkLoadTab.MANAGE_HISTORY)"
                   (selectTab)="selectTab(MemberBulkLoadTab.MANAGE_HISTORY)">
                <div class="admin-frame round-except-top-left">
                  <div class="admin-header-background rounded">
                    <div class="admin-header-container-with-tabs p-3">
                      <p class="form-text text-muted mb-3">
                        Filter upload history by date, tick the sessions you want to remove, then delete the selection.
                        These sessions drive “received in last bulk load” and the next Ramblers Team Emails snapshot
                        reconciliation. Member action rows for deleted sessions are removed too. File admins and member
                        admins only.
                      </p>
                      @if (!canManageUploadHistory) {
                        <div class="alert alert-warning mb-0">
                          <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
                          You need file admin or member admin access to manage upload history.
                        </div>
                      } @else if (!uploadHistoryLoaded) {
                        <div class="text-center mt-3">
                          <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading upload history...</span>
                          </div>
                        </div>
                      } @else if (memberBulkLoadAudits.length === 0) {
                        <div class="alert alert-warning mb-0">
                          <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
                          No upload history sessions are stored.
                        </div>
                      } @else {
                        <div class="bulk-load-viewport-panel">
                        <div class="row align-items-end g-3 mb-3">
                          <div class="col-12 col-md-4 col-lg-3">
                            <label class="form-label" for="history-preset">Date range preset</label>
                            <select id="history-preset"
                                    class="form-select"
                                    [(ngModel)]="historyPreset"
                                    (ngModelChange)="onHistoryPresetChange($event)">
                              @for (option of historyPresetOptions; track option.value) {
                                <option [value]="option.value">{{ historyPresetLabel(option.value) }}</option>
                              }
                            </select>
                          </div>
                          <div class="col-12 col-md-8 col-lg-9">
                            @if (historyMinDate && historyMaxDate) {
                              <app-date-range-slider
                                [minDate]="historyMinDate"
                                [maxDate]="historyMaxDate"
                                [range]="historyRange"
                                (rangeChange)="onHistoryRangeChange($event)"/>
                            }
                          </div>
                        </div>
                        <p class="mb-3">
                          {{ manageHistorySummary }}
                        </p>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                          <button type="button"
                                  class="btn btn-quiet"
                                  [disabled]="notifyTarget.busy || selectedHistorySessionIds.length === 0"
                                  (click)="deleteSelectedHistorySessions()">
                            <fa-icon [icon]="faTrash" class="me-1"/>
                            {{ deleteSelectedArmed
                              ? "Confirm delete selected sessions"
                              : deleteSelectedLabel }}
                          </button>
                          @if (deleteSelectedArmed) {
                            <button type="button"
                                    class="btn btn-quiet"
                                    [disabled]="notifyTarget.busy"
                                    (click)="cancelDeleteSelected()">
                              Cancel
                            </button>
                          }
                        </div>
                        @if (notifyTarget.showAlert) {
                          <div class="alert {{ notifyTarget.alertClass }} mb-3">
                            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                            @if (notifyTarget.alertTitle) {
                              <strong> {{ notifyTarget.alertTitle }}: </strong>
                            }
                            {{ notifyTarget.alertMessage }}
                          </div>
                          @if (notifyTarget.showProgress) {
                            <div class="progress mb-3" style="height: 24px;">
                              <div class="progress-bar progress-bar-striped progress-bar-animated"
                                   role="progressbar"
                                   [style.width.%]="notifyTarget.progressPercent || 0"
                                   [attr.aria-valuenow]="notifyTarget.progressPercent || 0"
                                   aria-valuemin="0"
                                   aria-valuemax="100">
                                @if (notifyTarget.progressPercent) {
                                  {{ notifyTarget.progressPercent }}%
                                }
                              </div>
                            </div>
                          }
                        }
                        @if (sessionsInHistoryRange.length > 0) {
                          <div class="bulk-load-panel-scroll">
                            <div class="ngx-data-table-card mb-0">
                              <table class="ngx-data-table">
                                <thead>
                                <tr>
                                  <th class="text-center" style="width: 2.5rem;">
                                    <input type="checkbox"
                                           class="form-check-input"
                                           id="select-all-history-sessions"
                                           [checked]="allHistorySessionsSelected"
                                           [disabled]="notifyTarget.busy"
                                           (change)="onSelectAllHistorySessionsChange($event)"
                                           [attr.aria-label]="'Select all sessions in range'">
                                  </th>
                                  <th>Uploaded at</th>
                                  <th>Source</th>
                                  <th>Members in session</th>
                                </tr>
                                </thead>
                                <tbody>
                                  @for (session of sessionsInHistoryRange; track session.id) {
                                    <tr>
                                      <td class="text-center">
                                        <input type="checkbox"
                                               class="form-check-input"
                                               [id]="'history-session-' + session.id"
                                               [checked]="historySessionSelected(session)"
                                               [disabled]="notifyTarget.busy || !session.id"
                                               (change)="onHistorySessionCheckboxChange(session, $event)"
                                               [attr.aria-label]="'Select session from ' + (session.createdDate | displayDateAndTime)">
                                      </td>
                                      <td>{{ session.createdDate | displayDateAndTime }}</td>
                                      <td>{{ memberBulkLoadSourceLabel(session.source) }}</td>
                                      <td>{{ session.members?.length || 0 }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          </div>
                        }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="MemberBulkLoadTab.MEMBER_SYNC_NOTIFICATIONS"
                   [active]="tabActive(MemberBulkLoadTab.MEMBER_SYNC_NOTIFICATIONS)"
                   (selectTab)="selectTab(MemberBulkLoadTab.MEMBER_SYNC_NOTIFICATIONS)">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <p class="form-text text-muted">
                    When a sync finds a member whose local record differs from Head Office, it queues a notification
                    instead of emailing. Review the queue and send on demand from the dedicated page.
                  </p>
                  <button type="button" class="btn btn-primary"
                          (click)="openMemberSyncNotifications()">Open member sync notifications
                  </button>
                </div>
              </tab>
            </tabset>
          </div>
        </div>
      </div>
    </app-page>`,
  styleUrls: ["./member-bulk-load.component.sass", "../admin/admin.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, FontAwesomeModule, FileUploadModule, NgClass, StatusIconComponent, FormsModule, LinkComponent, DecimalPipe, TitleCasePipe, DisplayDateAndTimePipe, FullNamePipe, MemberIdToFullNamePipe, RouterLink, DateRangeSlider]
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
  private memberLoginService = inject(MemberLoginService);
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
  public canManageUploadHistory = false;
  public deleteSelectedArmed = false;
  public selectedHistorySessionIds: string[] = [];
  public historyPreset: MemberBulkLoadHistoryPreset = MemberBulkLoadHistoryPreset.ALL_SESSIONS;
  public historyPresetOptions: KeyValue<string>[] = enumKeyValues(MemberBulkLoadHistoryPreset);
  public historyMinDate: DateTime | null = null;
  public historyMaxDate: DateTime | null = null;
  public historyRange: DateRange | null = null;
  public sessionsInHistoryRange: MemberBulkLoadAudit[] = [];
  private pendingHistoryFrom: string | null = null;
  private pendingHistoryTo: string | null = null;
  protected readonly memberBulkLoadSourceLabel = memberBulkLoadSourceLabel;
  protected readonly MemberBulkLoadHistoryPreset = MemberBulkLoadHistoryPreset;
  public uploadSessionStatuses: SessionStatus[] = [
    {title: "All"},
    {status: MemberAction.created, title: "Created"},
    {status: MemberAction.skipped, title: "Skipped"},
    {status: MemberAction.updated, title: "Updated"},
    {status: MemberAction.error, title: "Error"}];
  public uploadSession: MemberBulkLoadAudit | null = null;
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
  public memberTabHeading = "0 Members uploaded";
  public auditTabHeading = "0 Member audits";
  public uploadHistoryLoaded = false;
  public systemConfig: SystemConfig;
  private salesforceConfigService = inject(SalesforceConfigService);
  private salesforceSyncService = inject(SalesforceSyncService);
  private uiActionsService = inject(UiActionsService);
  private dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  faEnvelopesBulk = faEnvelopesBulk;
  faSearch = faSearch;
  faCloudArrowDown = faCloudArrowDown;
  faTrash = faTrash;
  salesforceConfig: SalesforceConfig | null = null;
  salesforceSyncing = false;
  salesforceSyncAuditLog: StatusMessage[] = [];
  protected readonly MemberBulkLoadTab = MemberBulkLoadTab;
  protected readonly MemberBulkLoadSubTab = MemberBulkLoadSubTab;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  adminSettingsSystemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  protected readonly salesforceSettingsQueryParams = {
    [StoredValue.TAB]: kebabCase(SystemSettingsTab.EXTERNAL_SYSTEMS),
    [StoredValue.SUB_TAB]: kebabCase(ExternalSystemsSubTab.RAMBLERS_TEAM_EMAILS)
  };
  public tab: string = kebabCase(MemberBulkLoadTab.INSIGHT_HUB_IMPORT);
  public subTab: string = kebabCase(MemberBulkLoadSubTab.MEMBERS_UPLOADED);
  private pendingSessionParam: string | null = null;
  private applyingQueryParams = false;

  ngOnInit() {
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
    this.canManageUploadHistory = this.memberLoginService.allowFileAdmin() || this.memberLoginService.allowMemberAdminEdits();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.logger.debug("loginResponse", loginResponse);
      this.canManageUploadHistory = this.memberLoginService.allowFileAdmin() || this.memberLoginService.allowMemberAdminEdits();
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
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      this.applyStateFromQueryParams(params);
    }));

    this.searchChangeObservable = new Subject<string>();
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        this.filterLists();
        this.syncUploadHistoryQueryParams();
      }));
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

    void this.refreshMembers();
    this.memberBulkLoadAuditService.all({
      sort: {createdDate: -1}
    }).then(memberBulkLoadAudits => {
      this.logger.debug("found", this.stringUtils.pluraliseWithCount(memberBulkLoadAudits.length, "memberBulkLoadAudit"));
      this.memberBulkLoadAudits = memberBulkLoadAudits;
      this.applyPendingSessionSelection();
      this.initialiseHistoryRangeFromSessions();
      if (this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY)) {
        this.ensureUploadHistoryPopulated();
      } else if (this.uploadSession) {
        this.filterLists();
      }
    }).catch(error => {
      this.logger.error("failed to load upload history:", error);
      this.memberBulkLoadAudits = [];
      this.initialiseHistoryRangeFromSessions();
    }).finally(() => {
      this.uploadHistoryLoaded = true;
      if (this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY) && this.uploadSession) {
        this.ensureUploadHistoryPopulated();
      }
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

  openMemberSyncNotifications() {
    this.urlService.navigateTo(["admin", "members", "member-sync-notifications"]);
  }

  get manageHistorySummary(): string {
    const sessionCount = this.sessionsInHistoryRange.length;
    const memberCount = reduce(this.sessionsInHistoryRange, (total, session) => total + (session.members?.length || 0), 0);
    const selectedCount = this.selectedHistorySessionIds.length;
    if (!this.historyRange || sessionCount === 0) {
      return "No upload sessions match the selected date range.";
    }
    const fromLabel = this.dateUtils.displayDateAndTime(this.historyRange.from);
    const toLabel = this.dateUtils.displayDateAndTime(this.historyRange.to);
    const selectionLabel = selectedCount === 0
      ? "None selected"
      : `${this.stringUtils.pluraliseWithCount(selectedCount, "session")} selected`;
    return `${this.stringUtils.pluraliseWithCount(sessionCount, "session")} between ${fromLabel} and ${toLabel} (${this.stringUtils.pluraliseWithCount(memberCount, "member")} in snapshots). ${selectionLabel}.`;
  }

  get deleteSelectedLabel(): string {
    const count = this.selectedHistorySessionIds.length;
    if (count === 0) {
      return "Delete selected sessions";
    }
    return `Delete ${this.stringUtils.pluraliseWithCount(count, "selected session")}`;
  }

  get allHistorySessionsSelected(): boolean {
    return this.sessionsInHistoryRange.length > 0
      && this.sessionsInHistoryRange.every(session => !!session.id && this.selectedHistorySessionIds.includes(session.id));
  }

  historyPresetLabel(option: string): string {
    switch (option) {
      case MemberBulkLoadHistoryPreset.LAST_7_DAYS:
        return "Last 7 days";
      case MemberBulkLoadHistoryPreset.LAST_30_DAYS:
        return "Last 30 days";
      case MemberBulkLoadHistoryPreset.LAST_90_DAYS:
        return "Last 90 days";
      case MemberBulkLoadHistoryPreset.LAST_1_YEAR:
        return "Last 1 year";
      case MemberBulkLoadHistoryPreset.OLDER_THAN_1_YEAR:
        return "Older than 1 year";
      case MemberBulkLoadHistoryPreset.ALL_SESSIONS:
        return "All sessions";
      case MemberBulkLoadHistoryPreset.CUSTOM:
        return "Custom";
      default:
        return option;
    }
  }

  onHistoryPresetChange(preset: MemberBulkLoadHistoryPreset): void {
    this.historyPreset = preset;
    this.deleteSelectedArmed = false;
    if (preset === MemberBulkLoadHistoryPreset.CUSTOM) {
      this.syncManageHistoryQueryParams();
      return;
    }
    this.applyHistoryPreset(preset);
  }

  onHistoryRangeChange(range: DateRange): void {
    this.historyRange = range;
    if (this.historyPreset !== MemberBulkLoadHistoryPreset.CUSTOM) {
      this.historyPreset = MemberBulkLoadHistoryPreset.CUSTOM;
    }
    this.deleteSelectedArmed = false;
    this.refreshSessionsInHistoryRange();
    this.syncManageHistoryQueryParams();
  }

  historySessionSelected(session: MemberBulkLoadAudit): boolean {
    return !!session.id && this.selectedHistorySessionIds.includes(session.id);
  }

  onHistorySessionCheckboxChange(session: MemberBulkLoadAudit, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!session.id) {
      return;
    }
    this.deleteSelectedArmed = false;
    if (checked) {
      if (!this.selectedHistorySessionIds.includes(session.id)) {
        this.selectedHistorySessionIds = [...this.selectedHistorySessionIds, session.id];
      }
    } else {
      this.selectedHistorySessionIds = this.selectedHistorySessionIds.filter(id => id !== session.id);
    }
  }

  onSelectAllHistorySessionsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.deleteSelectedArmed = false;
    if (checked) {
      this.selectedHistorySessionIds = this.sessionsInHistoryRange
        .map(session => session.id)
        .filter((id): id is string => !!id);
    } else {
      this.selectedHistorySessionIds = [];
    }
  }

  cancelDeleteSelected(): void {
    this.deleteSelectedArmed = false;
    this.notify.hide();
  }

  async deleteSelectedHistorySessions(): Promise<void> {
    if (!this.canManageUploadHistory || this.notifyTarget.busy || this.selectedHistorySessionIds.length === 0) {
      return;
    }
    const sessionCount = this.selectedHistorySessionIds.length;
    if (!this.deleteSelectedArmed) {
      this.deleteSelectedArmed = true;
      this.notify.warning({
        title: "Delete upload history",
        message: `Click again to permanently delete ${this.stringUtils.pluraliseWithCount(sessionCount, "selected upload session")} and their member action rows. This cannot be undone.`
      });
      return;
    }
    this.deleteSelectedArmed = false;
    const idsToDelete = [...this.selectedHistorySessionIds];
    this.notify.progress({
      title: "Delete upload history",
      message: `Deleting ${this.stringUtils.pluraliseWithCount(sessionCount, "upload session")}`
    }, true);
    try {
      const result = await this.memberBulkLoadAuditService.deleteByIds(idsToDelete);
      this.selectedHistorySessionIds = [];
      this.uploadSession = null;
      this.pendingSessionParam = null;
      await this.refreshMemberBulkLoadAudit();
      this.notify.success({
        title: "Delete upload history",
        message: result.message || `Deleted ${this.stringUtils.pluraliseWithCount(result.deletedCount, "upload session")}`
      });
    } catch (error) {
      this.logger.error("deleteSelectedHistorySessions failed:", error);
      this.notify.error({
        title: "Delete upload history",
        message: this.stringUtils.stringify(error),
        continue: true
      });
    } finally {
      this.notify.clearBusy();
    }
  }

  private initialiseHistoryRangeFromSessions(): void {
    const dates = this.memberBulkLoadAudits
      .map(session => session.createdDate)
      .filter(value => isNumber(value));
    if (dates.length === 0) {
      this.historyMinDate = null;
      this.historyMaxDate = null;
      this.historyRange = null;
      this.sessionsInHistoryRange = [];
      return;
    }
    const earliest = min(dates) as number;
    const latest = max(dates) as number;
    this.historyMinDate = this.dateUtils.asDateTime(earliest).startOf("day");
    this.historyMaxDate = this.dateUtils.asDateTime(latest).startOf("day");
    if (this.historyPreset === MemberBulkLoadHistoryPreset.CUSTOM) {
      const pendingFrom = this.pendingHistoryFrom
        ? this.dateUtils.asValue(this.pendingHistoryFrom, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES)
        : this.historyRange?.from;
      const pendingTo = this.pendingHistoryTo
        ? this.dateUtils.asValue(this.pendingHistoryTo, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES)
        : this.historyRange?.to;
      this.pendingHistoryFrom = null;
      this.pendingHistoryTo = null;
      if (isNumber(pendingFrom) && pendingFrom > 0 && isNumber(pendingTo) && pendingTo > 0) {
        this.historyRange = {
          from: Math.max(this.historyMinDate.toMillis(), Math.min(pendingFrom, pendingTo)),
          to: Math.min(this.historyMaxDate.toMillis(), Math.max(pendingFrom, pendingTo))
        };
        this.refreshSessionsInHistoryRange();
        if (this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY)) {
          this.syncManageHistoryQueryParams();
        }
        return;
      }
    }
    this.applyHistoryPreset(this.historyPreset === MemberBulkLoadHistoryPreset.CUSTOM
      ? MemberBulkLoadHistoryPreset.ALL_SESSIONS
      : this.historyPreset);
  }

  private applyHistoryPreset(preset: MemberBulkLoadHistoryPreset): void {
    if (!this.historyMinDate || !this.historyMaxDate) {
      this.historyRange = null;
      this.sessionsInHistoryRange = [];
      return;
    }
    const now = this.dateUtils.dateTimeNow();
    const minMillis = this.historyMinDate.toMillis();
    const maxMillis = this.historyMaxDate.toMillis();
    const clamp = (from: number, to: number): DateRange => ({
      from: Math.max(minMillis, Math.min(from, maxMillis)),
      to: Math.max(minMillis, Math.min(to, maxMillis))
    });
    switch (preset) {
      case MemberBulkLoadHistoryPreset.LAST_7_DAYS:
        this.historyRange = clamp(now.minus({days: 7}).startOf("day").toMillis(), maxMillis);
        break;
      case MemberBulkLoadHistoryPreset.LAST_30_DAYS:
        this.historyRange = clamp(now.minus({days: 30}).startOf("day").toMillis(), maxMillis);
        break;
      case MemberBulkLoadHistoryPreset.LAST_90_DAYS:
        this.historyRange = clamp(now.minus({days: 90}).startOf("day").toMillis(), maxMillis);
        break;
      case MemberBulkLoadHistoryPreset.LAST_1_YEAR:
        this.historyRange = clamp(now.minus({years: 1}).startOf("day").toMillis(), maxMillis);
        break;
      case MemberBulkLoadHistoryPreset.OLDER_THAN_1_YEAR:
        this.historyRange = clamp(minMillis, now.minus({years: 1}).endOf("day").toMillis());
        break;
      case MemberBulkLoadHistoryPreset.ALL_SESSIONS:
      default:
        this.historyRange = {from: minMillis, to: maxMillis};
        break;
    }
    this.historyPreset = preset;
    this.refreshSessionsInHistoryRange();
    if (this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY)) {
      this.syncManageHistoryQueryParams();
    }
  }

  private refreshSessionsInHistoryRange(): void {
    if (!this.historyRange) {
      this.sessionsInHistoryRange = [];
      this.selectedHistorySessionIds = [];
      return;
    }
    const rangeStart = this.dateUtils.asDateTime(this.historyRange.from).startOf("day").toMillis();
    const rangeEnd = this.dateUtils.asDateTime(this.historyRange.to).endOf("day").toMillis();
    this.sessionsInHistoryRange = this.memberBulkLoadAudits.filter(session =>
      isNumber(session.createdDate)
      && session.createdDate >= rangeStart
      && session.createdDate <= rangeEnd);
    const visibleIds = this.sessionsInHistoryRange
      .map(session => session.id)
      .filter((id): id is string => !!id);
    this.selectedHistorySessionIds = this.selectedHistorySessionIds.filter(id => visibleIds.includes(id));
  }

  async triggerSalesforceSync() {
    if (this.salesforceSyncing) {
      return;
    }
    this.salesforceSyncing = true;
    this.salesforceSyncAuditLog = [];
    this.notify.setBusy();
    try {
      const apiResponse = await this.salesforceSyncService.sync(true);
      const audit = apiResponse?.response;
      this.salesforceSyncAuditLog = audit?.auditLog ?? [];
      if (apiResponse?.error) {
        this.notify.error({title: "Ramblers Team Emails sync failed", message: this.salesforceErrorText(apiResponse.error)});
        if (audit) {
          await this.memberBulkLoadAuditService.create(audit).catch(error => {
            this.logger.error("audit-create-error", error);
          });
        }
        return;
      }
      if (!audit) {
        this.notify.error({title: "Ramblers Team Emails sync failed", message: "Sync returned no result."});
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
      this.logger.error("Ramblers Team Emails sync error", error);
      this.notify.error({title: "Ramblers Team Emails sync failed", message: this.salesforceErrorText(error)});
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
    return record?.errorMessage || record?.errorCode || extractErrorMessage(error);
  }

  private filterLists(searchTerm?: string) {
    this.applyFilterToList(this.filters.membersUploaded, this.uploadSession?.members || []);
    this.applyFilterToList(this.filters.memberUpdateAudit, this.memberUpdateAudits);
    this.updateTabHeadings();
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  currentUploadItem() {
    return this.fileUploader.queue?.[0] || null;
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug(`received searchEntry:${searchEntry}`);
    this.searchChangeObservable.next(searchEntry);
  }

  private memberActionStatusTitles(): string[] {
    return this.uploadSessionStatuses.map(status => status.title);
  }

  private syncUploadHistoryQueryParams(): void {
    if (this.applyingQueryParams || !this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY)) {
      return;
    }
    const statusTitle = this.filters?.memberUpdateAudit?.query?.title;
    const isDefaultStatus = !statusTitle || statusTitle === this.uploadSessionStatuses[0].title;
    this.uiActionsService.updateQueryParameters({
      [StoredValue.TAB]: this.tab,
      [StoredValue.SUB_TAB]: this.subTab,
      [StoredValue.SEARCH]: this.quickSearch?.trim() || null,
      [StoredValue.SESSION]: this.sessionToUrlParam(this.uploadSession?.createdDate) || null,
      [StoredValue.STATUS]: isDefaultStatus ? null : kebabCase(statusTitle),
      [StoredValue.DATE_RANGE_PRESET]: null,
      [StoredValue.DATE_FROM]: null,
      [StoredValue.DATE_TO]: null
    });
  }

  private syncManageHistoryQueryParams(): void {
    if (this.applyingQueryParams || !this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY)) {
      return;
    }
    const isCustom = this.historyPreset === MemberBulkLoadHistoryPreset.CUSTOM;
    this.uiActionsService.updateQueryParameters({
      [StoredValue.TAB]: this.tab,
      [StoredValue.SUB_TAB]: null,
      [StoredValue.SEARCH]: null,
      [StoredValue.SESSION]: null,
      [StoredValue.STATUS]: null,
      [StoredValue.DATE_RANGE_PRESET]: this.historyPreset,
      [StoredValue.DATE_FROM]: isCustom && this.historyRange
        ? this.dateUtils.yearMonthDayWithDashes(this.historyRange.from)
        : null,
      [StoredValue.DATE_TO]: isCustom && this.historyRange
        ? this.dateUtils.yearMonthDayWithDashes(this.historyRange.to)
        : null
    });
  }

  private clearTabScopedQueryParams(tab: string): void {
    this.uiActionsService.updateQueryParameters({
      [StoredValue.TAB]: tab,
      [StoredValue.SUB_TAB]: null,
      [StoredValue.SEARCH]: null,
      [StoredValue.SESSION]: null,
      [StoredValue.STATUS]: null,
      [StoredValue.DATE_RANGE_PRESET]: null,
      [StoredValue.DATE_FROM]: null,
      [StoredValue.DATE_TO]: null
    });
  }

  private sessionToUrlParam(createdDate?: number): string {
    if (!createdDate) {
      return "";
    }
    return this.dateUtils.asString(createdDate, undefined, UIDateFormat.YEAR_MONTH_DAY_T_HHMM);
  }

  private applyPendingSessionSelection(): void {
    if (!this.memberBulkLoadAudits?.length) {
      return;
    }
    if (this.pendingSessionParam) {
      const match = this.memberBulkLoadAudits.find(audit =>
        this.sessionToUrlParam(audit.createdDate) === this.pendingSessionParam
        || audit.id === this.pendingSessionParam);
      this.uploadSession = match || first(this.memberBulkLoadAudits);
    } else if (!this.uploadSession) {
      this.uploadSession = first(this.memberBulkLoadAudits);
    }
  }

  private applyStateFromQueryParams(params: Record<string, string>): void {
    this.applyingQueryParams = true;
    try {
      const previousSessionId = this.uploadSession?.id || null;
      const previousStatusTitle = this.filters?.memberUpdateAudit?.query?.title || null;
      const previousSearch = this.quickSearch;
      this.applyTabsFromQueryParams(params[StoredValue.TAB], params[StoredValue.SUB_TAB]);
      const onUploadHistory = this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY);
      const onManageHistory = this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY);
      this.quickSearch = onUploadHistory ? (params[StoredValue.SEARCH] || "") : "";
      const statusParam = onUploadHistory ? params[StoredValue.STATUS] : null;
      const resolvedStatus = this.uiActionsService.queryValueForAlias(statusParam ?? null, this.memberActionStatusTitles());
      this.filters.memberUpdateAudit.query = resolvedStatus
        ? this.uploadSessionStatuses.find(status => status.title === resolvedStatus) || this.uploadSessionStatuses[0]
        : this.uploadSessionStatuses[0];
      this.pendingSessionParam = onUploadHistory ? (params[StoredValue.SESSION] || null) : null;
      this.applyPendingSessionSelection();
      if (onManageHistory) {
        this.applyManageHistoryFromQueryParams(params);
      } else {
        this.pendingHistoryFrom = null;
        this.pendingHistoryTo = null;
      }
      if (onUploadHistory) {
        const sessionChanged = !!this.uploadSession && this.uploadSession.id !== previousSessionId;
        const statusChanged = this.filters.memberUpdateAudit.query?.title !== previousStatusTitle;
        const needsAuditRefresh = sessionChanged || statusChanged || !this.memberUpdateAudits?.length;
        if (needsAuditRefresh) {
          void this.refreshMemberUpdateAudit();
        } else {
          this.filterLists();
        }
      } else if (onManageHistory) {
        if (params[StoredValue.SUB_TAB] || params[StoredValue.SESSION] || params[StoredValue.SEARCH] || params[StoredValue.STATUS]) {
          this.syncManageHistoryQueryParams();
        }
      } else if (
        params[StoredValue.SUB_TAB]
        || params[StoredValue.SESSION]
        || params[StoredValue.SEARCH]
        || params[StoredValue.STATUS]
        || params[StoredValue.DATE_RANGE_PRESET]
        || params[StoredValue.DATE_FROM]
        || params[StoredValue.DATE_TO]
      ) {
        this.clearTabScopedQueryParams(this.tab);
      }
    } finally {
      this.applyingQueryParams = false;
    }
    if (this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY) && this.memberBulkLoadAudits.length > 0) {
      this.syncManageHistoryQueryParams();
    }
  }

  private applyManageHistoryFromQueryParams(params: Record<string, string>): void {
    const presetParam = params[StoredValue.DATE_RANGE_PRESET];
    const matchedPreset = this.historyPresetOptions.find(option => option.value === presetParam)?.value;
    if (matchedPreset) {
      this.historyPreset = matchedPreset as MemberBulkLoadHistoryPreset;
    }
    if (this.historyPreset === MemberBulkLoadHistoryPreset.CUSTOM) {
      this.pendingHistoryFrom = params[StoredValue.DATE_FROM] || null;
      this.pendingHistoryTo = params[StoredValue.DATE_TO] || null;
    } else {
      this.pendingHistoryFrom = null;
      this.pendingHistoryTo = null;
    }
    if (this.memberBulkLoadAudits.length > 0) {
      this.initialiseHistoryRangeFromSessions();
    }
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
        title: "Review member",
        message: "No existing member match was found. Review the details before saving this as a new member."
      });
    }
  }

  protected auditErrorText(audit: MemberUpdateAudit): string {
    const errorMessage = audit?.auditErrorMessage as any;
    if (!errorMessage) {
      return "Save failed";
    }
    if (isString(errorMessage)) {
      return errorMessage;
    }
    const detail = errorMessage.error || errorMessage.message;
    if (isString(detail)) {
      return detail.replace(/^ValidationError:\s*/i, "");
    }
    return this.stringUtils.stringify(errorMessage);
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

  protected auditChangeSummary(audit: MemberUpdateAudit): string {
    return this.memberBulkLoadService.summariseFieldChanges(audit.fieldChanges);
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
      }).catch(error => {
        this.logger.error("refreshMemberUpdateAudit failed:", error);
        this.memberUpdateAudits = [];
        this.filterLists();
        return this.memberUpdateAudits;
      });
    } else {
      this.memberUpdateAudits = [];
      this.logger.debug("no member audit records");
      this.filterLists();
      return Promise.resolve(this.memberUpdateAudits);
    }
  }

  private updateTabHeadings() {
    this.auditTabHeading = this.memberUpdateAuditSummary();
    this.memberTabHeading = `${this.filters.membersUploaded.results.length || 0} Members uploaded`;
  }

  tabActive(tab: MemberBulkLoadTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  subTabActive(subTab: MemberBulkLoadSubTab): boolean {
    return kebabCase(this.subTab) === kebabCase(subTab);
  }

  selectTab(tab: MemberBulkLoadTab): void {
    const nextTab = kebabCase(tab);
    if (this.tab === nextTab) {
      return;
    }
    const leavingManageHistory = this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY);
    this.tab = nextTab;
    if (leavingManageHistory) {
      this.deleteSelectedArmed = false;
      this.notify.hide();
    }
    const onUploadHistory = this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY);
    const onManageHistory = this.tabActive(MemberBulkLoadTab.MANAGE_HISTORY);
    if (onUploadHistory && !this.subTab) {
      this.subTab = kebabCase(MemberBulkLoadSubTab.MEMBERS_UPLOADED);
    }
    if (onUploadHistory) {
      this.ensureUploadHistoryPopulated();
      this.syncUploadHistoryQueryParams();
    } else if (onManageHistory) {
      this.syncManageHistoryQueryParams();
    } else {
      this.clearTabScopedQueryParams(this.tab);
    }
  }

  private ensureUploadHistoryPopulated(): void {
    if (!this.uploadSession) {
      this.applyPendingSessionSelection();
    }
    this.filterLists();
    if (this.uploadSession?.id) {
      void this.refreshMemberUpdateAudit();
    } else {
      this.memberUpdateAudits = [];
      this.updateTabHeadings();
    }
  }

  memberTrack(member: { membershipNumber?: string; email?: string }, index: number): string {
    return member?.membershipNumber || member?.email || `member-${index}`;
  }

  selectSubTab(subTab: MemberBulkLoadSubTab): void {
    this.subTab = kebabCase(subTab);
    if (!this.tabActive(MemberBulkLoadTab.UPLOAD_HISTORY)) {
      return;
    }
    this.syncUploadHistoryQueryParams();
  }

  private applyTabsFromQueryParams(tabParam: string | null | undefined, subTabParam: string | null | undefined): void {
    const resolvedTab = this.resolveMainTab(tabParam);
    const resolvedSubTab = this.uiActionsService.queryValueForAlias(subTabParam ?? null, values(MemberBulkLoadSubTab));
    this.tab = kebabCase(resolvedTab);
    this.subTab = kebabCase(resolvedSubTab || MemberBulkLoadSubTab.MEMBERS_UPLOADED);
    this.logger.debug("applyTabsFromQueryParams:", {tabParam, subTabParam, tab: this.tab, subTab: this.subTab});
  }

  private resolveMainTab(tabParam: string | null | undefined): MemberBulkLoadTab {
    if (!tabParam
      || tabParam === LegacyMemberBulkLoadTabSlug.NEW_UPLOAD
      || tabParam === LegacyMemberBulkLoadTabSlug.HELP) {
      return MemberBulkLoadTab.INSIGHT_HUB_IMPORT;
    }
    if (tabParam === LegacyMemberBulkLoadTabSlug.SYNC_FROM_SALESFORCE
      || tabParam === LegacyMemberBulkLoadTabSlug.SALESFORCE
      || tabParam === LegacyMemberBulkLoadTabSlug.HEAD_OFFICE_SUPPORTER_IMPORT) {
      return MemberBulkLoadTab.RAMBLERS_TEAM_EMAILS;
    }
    if (tabParam === LegacyMemberBulkLoadTabSlug.SYNC_NOTIFICATIONS) {
      return MemberBulkLoadTab.MEMBER_SYNC_NOTIFICATIONS;
    }
    const resolved = this.uiActionsService.queryValueForAlias(tabParam, values(MemberBulkLoadTab));
    return (resolved as MemberBulkLoadTab) || MemberBulkLoadTab.INSIGHT_HUB_IMPORT;
  }

  uploadSessionChanged() {
    this.notify.setBusy();
    this.notify.hide();
    this.logger.info("upload session:", this.uploadSession);
    this.syncUploadHistoryQueryParams();
    this.filterLists();
    this.refreshMemberUpdateAudit().then(() => this.notify.clearBusy());
  }

  sortMembersUploadedBy(field) {
    this.applySortTo(field, this.filters.membersUploaded, this.uploadSession?.members || []);
  }

  refreshMemberBulkLoadAudit(): Promise<any> {
    return this.memberBulkLoadAuditService.all({
      sort: {createdDate: -1}
    }).then(uploadSessions => {
      this.logger.debug("refreshed", uploadSessions && uploadSessions.length, "upload sessions");
      this.memberBulkLoadAudits = uploadSessions;
      const currentSessionId = this.uploadSession?.id;
      if (currentSessionId) {
        const stillPresent = uploadSessions.find(session => session.id === currentSessionId);
        this.uploadSession = stillPresent || first(uploadSessions) || null;
      } else {
        this.applyPendingSessionSelection();
        if (!this.uploadSession) {
          this.uploadSession = first(uploadSessions) || null;
        }
      }
      this.initialiseHistoryRangeFromSessions();
      this.filterLists();
      this.syncUploadHistoryQueryParams();
      return true;
    }).finally(() => {
      this.uploadHistoryLoaded = true;
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
