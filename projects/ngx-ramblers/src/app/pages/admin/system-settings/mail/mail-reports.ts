import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faBan,
  faEnvelopeOpenText,
  faInbox,
  faPlay,
  faRefresh,
  faSearch,
  faSort,
  faSortDown,
  faSortUp,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { isNumber } from "es-toolkit/compat";
import { DateTime } from "luxon";
import { Subject, Subscription } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { BrevoCampaignProgress, BrevoCampaignQueueSummary } from "../../../../models/brevo-campaign-queue.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { AdminPath } from "../../../../models/admin-route-paths.model";
import {
  BrevoEmailPreviewContent,
  BrevoTransactionalAggregatedReport,
  BrevoTransactionalEmailSummary,
  MailReportStatTile,
  TransactionalEmailOrigin,
  TransactionalSendActionGroup
} from "../../../../models/mail.model";
import { SortDirection } from "../../../../models/sort.model";
import { StoredValue } from "../../../../models/ui-actions";
import { PageComponent } from "../../../../page/page.component";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { MailService } from "../../../../services/mail/mail.service";
import { BrevoContactService } from "../../../../services/mail/brevo-contact.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { DraggableModalComponent } from "../../../../modules/common/draggable-modal/draggable-modal";
import { EmailPreviewComponent } from "../../../../modules/common/email-preview/email-preview.component";
import { groupTransactionalEmailsBySendAction } from "../../../../functions/transactional-send-grouping";
import { isInboxDigestSubject } from "../../../../functions/transactional-email-origin";
enum CampaignSortField {
  SUBJECT = "subject",
  SENT = "sent",
  DELIVERED = "delivered",
  VIEWED = "viewed",
  UNIQUE_VIEWS = "unique-views",
  CLICKS = "unique-clicks",
  HARD_BOUNCES = "hard-bounces",
  SOFT_BOUNCES = "soft-bounces",
  UNSUBSCRIPTIONS = "unsubscriptions",
  COMPLAINTS = "complaints",
  SENT_DATE = "sent-date"
}

enum MailReportType {
  CAMPAIGNS = "campaigns",
  TRANSACTIONAL = "transactional"
}

@Component({
  selector: "app-mail-reports",
  standalone: true,
  imports: [DateRangeSlider, DraggableModalComponent, EmailPreviewComponent, FontAwesomeModule, FormsModule, PageComponent, RouterLink, SectionToggle],
  template: `
    <app-page autoTitle>
      <p>Brevo campaign and transactional email statistics.</p>
      <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div class="form-group">
          <label class="d-block">Type</label>
          <app-section-toggle
            [tabs]="reportTypeLabels"
            [selectedTab]="selectedReportTypeLabel"
            (selectedTabChange)="selectReportTypeByLabel($event)"/>
        </div>
        <div class="form-group">
          <label class="d-block">Range</label>
          <app-section-toggle
            [tabs]="presetLabels"
            [selectedTab]="selectedPresetLabel"
            (selectedTabChange)="selectPresetByLabel($event)"/>
        </div>
        <div class="form-group flex-grow-1">
          <app-date-range-slider
            [minDate]="sliderMinDate"
            [maxDate]="sliderMaxDate"
            [range]="sliderRange"
            (rangeChange)="onRangeChange($event)"/>
        </div>
        <div class="form-group">
          <button type="button" class="btn btn-primary" [disabled]="busy" (click)="refresh()">
            <fa-icon [icon]="busy ? faSpinner : faRefresh" [animation]="busy ? 'spin' : null"/> Refresh
          </button>
        </div>
      </div>
      @if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      }

      @if (reportType === MailReportType.CAMPAIGNS) {
        @if (summary) {
          @if (campaignStatTiles.length > 0) {
            <h5 class="mt-3">Campaign Activity</h5>
            <div class="row mb-3 g-2">
              @for (tile of campaignStatTiles; track tile.key) {
                <div class="col">
                  <div class="stat-tile">
                    <div class="stat-value">{{ tile.value }}</div>
                    <div class="stat-label">{{ tile.label }}</div>
                  </div>
                </div>
              }
            </div>
          }

          @if (summary.pendingCampaigns.length > 0) {
            <h5 class="mt-4">Pending Remainders</h5>
            <div class="ngx-data-table-card">
              <table class="ngx-data-table">
                <thead>
                  <tr><th>Campaign</th><th>Sent so far</th><th>Remaining</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (campaign of summary.pendingCampaigns; track campaign.id) {
                    <tr>
                      <td><strong>{{ campaign.subject }}</strong><div class="small text-muted">{{ campaign.name }}</div></td>
                      <td>{{ campaign.sent }}</td>
                      <td>{{ campaign.remaining }}</td>
                      <td>{{ campaign.status }}</td>
                      <td class="d-flex gap-2">
                        <button type="button" class="btn btn-primary btn-sm" [disabled]="busy" (click)="release(campaign)">
                          <fa-icon [icon]="faPlay"/> Release now
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" [disabled]="busy" (click)="cancel(campaign)">
                          <fa-icon [icon]="faBan"/> Cancel remainder
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <h5 class="mt-4">Completed Campaigns</h5>
          <p class="text-muted">Showing {{ dateRangeLabel }}.</p>
          <div class="row mb-3">
            <div class="col-sm-12">
              <div class="input-group">
                <span class="input-group-text"><fa-icon [icon]="faSearch"/></span>
                <input type="text" class="form-control" [(ngModel)]="searchTerm"
                       (ngModelChange)="updateQueryParams()"
                       placeholder="Filter by campaign name or subject...">
              </div>
            </div>
          </div>
          @if (summary.completedCampaigns.length === 0) {
            <p class="text-muted">No completed {{ groupLongName }} campaigns were found in this period.</p>
          } @else {
            <div class="ngx-data-table-card">
              <table class="ngx-data-table">
                <thead>
                  <tr>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.SUBJECT" (click)="toggleSort(CampaignSortField.SUBJECT)">Campaign <fa-icon [icon]="sortIcon(CampaignSortField.SUBJECT)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.SENT" (click)="toggleSort(CampaignSortField.SENT)">Sent <fa-icon [icon]="sortIcon(CampaignSortField.SENT)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.DELIVERED" (click)="toggleSort(CampaignSortField.DELIVERED)">Delivered <fa-icon [icon]="sortIcon(CampaignSortField.DELIVERED)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.VIEWED" (click)="toggleSort(CampaignSortField.VIEWED)">Opens <fa-icon [icon]="sortIcon(CampaignSortField.VIEWED)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.UNIQUE_VIEWS" (click)="toggleSort(CampaignSortField.UNIQUE_VIEWS)">Unique Opens <fa-icon [icon]="sortIcon(CampaignSortField.UNIQUE_VIEWS)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.CLICKS" (click)="toggleSort(CampaignSortField.CLICKS)">Clicks <fa-icon [icon]="sortIcon(CampaignSortField.CLICKS)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.HARD_BOUNCES" (click)="toggleSort(CampaignSortField.HARD_BOUNCES)">Hard Bounces <fa-icon [icon]="sortIcon(CampaignSortField.HARD_BOUNCES)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.SOFT_BOUNCES" (click)="toggleSort(CampaignSortField.SOFT_BOUNCES)">Soft Bounces <fa-icon [icon]="sortIcon(CampaignSortField.SOFT_BOUNCES)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.UNSUBSCRIPTIONS" (click)="toggleSort(CampaignSortField.UNSUBSCRIPTIONS)">Unsubs <fa-icon [icon]="sortIcon(CampaignSortField.UNSUBSCRIPTIONS)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.COMPLAINTS" (click)="toggleSort(CampaignSortField.COMPLAINTS)">Complaints <fa-icon [icon]="sortIcon(CampaignSortField.COMPLAINTS)" size="xs"/></th>
                    <th class="sortable" [class.sorted]="sortField === CampaignSortField.SENT_DATE" (click)="toggleSort(CampaignSortField.SENT_DATE)">Completed <fa-icon [icon]="sortIcon(CampaignSortField.SENT_DATE)" size="xs"/></th>
                  </tr>
                </thead>
                <tbody>
                  @for (campaign of sortedCampaigns; track campaign.id) {
                    <tr class="clickable-row" (click)="openCampaignDrillDown(campaign)">
                      <td><strong>{{ campaign.subject }}</strong><div class="small text-muted">{{ campaign.name }}</div></td>
                      <td>{{ campaign.sent }}</td>
                      <td>{{ campaign.delivered }}</td>
                      <td>{{ campaign.viewed }}</td>
                      <td>{{ campaign.uniqueViews }}</td>
                      <td>{{ campaign.uniqueClicks }}</td>
                      <td>{{ campaign.hardBounces }}</td>
                      <td>{{ campaign.softBounces }}</td>
                      <td>{{ campaign.unsubscriptions }}</td>
                      <td>{{ campaign.complaints }}</td>
                      <td>{{ formatDate(campaign.sentDate || campaign.modifiedAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }

      @if (reportType === MailReportType.TRANSACTIONAL) {
        @if (transactionalStatTiles.length > 0) {
          <h5 class="mt-3">Transactional Email Activity</h5>
          <p class="text-muted small mb-2">Includes list-subset sends, login mail, and inbox replies. Grouped by send action. Click <strong>Sent</strong> to show or hide the list.</p>
          <div class="row mb-3 g-2">
            @for (tile of transactionalStatTiles; track tile.key) {
              @if (tile.key === "sent") {
                <div class="col clickable" (click)="toggleTransactionalRecipients()" role="button" title="Show or hide recipients">
                  <div class="stat-tile" [class.selected]="showTransactionalRecipients">
                    <div class="stat-value">{{ tile.value }}</div>
                    <div class="stat-label">{{ tile.label }}</div>
                  </div>
                </div>
              } @else {
                <div class="col">
                  <div class="stat-tile">
                    <div class="stat-value">{{ tile.value }}</div>
                    <div class="stat-label">{{ tile.label }}</div>
                  </div>
                </div>
              }
            }
          </div>
          @if (showTransactionalRecipients) {
            <section class="mb-4">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <h5 class="mb-0">Who was sent mail
                  <span class="text-muted fw-normal small">({{ sendActionSummaryLabel }})</span>
                </h5>
                <div class="d-flex align-items-center gap-3">
                  @if (hiddenInboxDigestCount > 0 || showInboxDigests) {
                    <div class="form-check mb-0">
                      <input class="form-check-input" type="checkbox" id="show-inbox-digests"
                             [ngModel]="showInboxDigests" (ngModelChange)="onShowInboxDigestsChange($event)">
                      <label class="form-check-label small" for="show-inbox-digests">
                        Show inbox digests
                        @if (hiddenInboxDigestCount > 0 && !showInboxDigests) {
                          <span class="text-muted">({{ hiddenInboxDigestCount }} hidden)</span>
                        }
                      </label>
                    </div>
                  }
                  @if (loadingTransactionalEmails) {
                    <span class="text-muted small"><fa-icon [icon]="faSpinner" [animation]="'spin'"/> Loading</span>
                  }
                </div>
              </div>
              @if (visibleTransactionalSendGroups.length > 0) {
                @for (group of visibleTransactionalSendGroups; track group.id) {
                  <div class="send-action-card mb-3">
                    <div class="send-action-header" (click)="toggleSendActionGroup(group.id)" role="button">
                      <div class="send-action-title">
                        <strong>{{ group.subjectStem }}</strong>
                        <div class="small text-muted">
                          <span [class]="'origin-badge origin-' + group.origin">{{ group.originLabel }}</span>
                          · {{ stringUtils.pluraliseWithCount(group.recipients.length, "recipient") }}
                          · {{ formatDateTime(group.sentAt) }}
                          @if (group.from) {
                            · from {{ group.from }}
                          }
                        </div>
                      </div>
                      <span class="small text-muted">{{ expandedSendActionIds.has(group.id) ? "Hide" : "Show" }}</span>
                    </div>
                    @if (expandedSendActionIds.has(group.id)) {
                      <div class="ngx-data-table-card send-action-recipients">
                        <table class="ngx-data-table send-action-recipients-table">
                          <colgroup>
                            <col class="col-recipient"/>
                            <col class="col-subject"/>
                            <col class="col-sent"/>
                          </colgroup>
                          <thead>
                            <tr><th>Recipient</th><th>Personalised subject</th><th>Sent</th></tr>
                          </thead>
                          <tbody>
                            @for (email of group.recipients; track email.messageId || email.email + email.date) {
                              <tr>
                                <td [title]="email.email">{{ email.email }}</td>
                                <td [title]="email.subject">{{ email.subject }}</td>
                                <td class="sent-cell">
                                  <span class="sent-when">{{ formatDateTime(email.date) }}</span>
                                  <span class="action-buttons">
                                    <button type="button" class="btn btn-sm btn-quiet action-icon-btn"
                                            (click)="openEmailPreview(email); $event.stopPropagation()"
                                            [disabled]="previewLoadingKey === previewKey(email)"
                                            title="View email"
                                            aria-label="View email">
                                      <fa-icon [icon]="previewLoadingKey === previewKey(email) ? faSpinner : faEnvelopeOpenText"
                                               [animation]="previewLoadingKey === previewKey(email) ? 'spin' : null"/>
                                    </button>
                                    @if (email.threadId) {
                                      <a class="btn btn-sm btn-quiet action-icon-btn"
                                         [routerLink]="['/' + AdminPath.INBOX]"
                                         [queryParams]="inboxThreadQueryParams(email.threadId)"
                                         (click)="$event.stopPropagation()"
                                         title="Open in inbox"
                                         aria-label="Open in inbox">
                                        <fa-icon [icon]="faInbox"/>
                                      </a>
                                    }
                                  </span>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>
                }
              } @else if (!loadingTransactionalEmails) {
                <p class="text-muted">
                  @if (hiddenInboxDigestCount > 0 && !showInboxDigests) {
                    Only inbox digests were found in this period. Turn on <strong>Show inbox digests</strong> to list them.
                  } @else {
                    No transactional recipient records were found in this period.
                  }
                </p>
              }
            </section>
          }
        } @else if (!busy) {
          <p class="text-muted mt-3">No transactional email activity was found in this period.</p>
        }
      }

      <app-draggable-modal [open]="!!emailPreview" contentWidth="min(920px, 95vw)" (closed)="closeEmailPreview()">
        <div modalTitle>
          <div class="text-truncate"
               [title]="emailPreview?.content?.subject || emailPreview?.summary?.subject || ''">
            <fa-icon [icon]="faEnvelopeOpenText" class="me-2"/>
            {{ emailPreview?.content?.subject || emailPreview?.summary?.subject }}
          </div>
          @if (emailPreview) {
            <div class="small text-white-50 text-truncate">
              To {{ emailPreview.summary.email }}
              · {{ formatDateTime(emailPreview.content?.date || emailPreview.summary.date) }}
            </div>
          }
        </div>
        <div modalBody>
          @if (emailPreview?.loading) {
            <div class="text-muted"><fa-icon [icon]="faSpinner" [animation]="'spin'"/> Loading email content…</div>
          } @else if (emailPreview?.error) {
            <div class="alert alert-warning mb-0">{{ emailPreview.error }}</div>
          } @else if (emailPreview?.content?.body) {
            <app-email-preview [html]="emailPreview.content.body"/>
          } @else {
            <div class="text-muted">No HTML body is available for this email.</div>
          }
        </div>
        @if (emailPreview?.summary?.threadId) {
          <a modalFooter class="btn btn-primary"
             [routerLink]="['/' + AdminPath.INBOX]"
             [queryParams]="inboxThreadQueryParams(emailPreview.summary.threadId)"
             (click)="closeEmailPreview()">
            <fa-icon [icon]="faInbox" class="me-2"/>Open in inbox
          </a>
        }
      </app-draggable-modal>
    </app-page>
  `,
  styles: [`
    .stat-tile
      background: var(--rsm-table-header-bg)
      border: 1px solid rgba(155, 200, 171, 0.4)
      border-radius: 8px
      padding: 0.75rem 0.5rem
      text-align: center
      min-width: 80px
      height: 100%
      display: flex
      flex-direction: column
      align-items: center
      justify-content: center
      gap: 0.15rem

    .col.clickable .stat-tile
      cursor: pointer
      border-color: rgba(29, 111, 66, 0.55)

    .col.clickable .stat-tile:hover
      transform: translateY(-1px)
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)

    .stat-tile.selected
      border-color: #2d3e33
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.5), rgba(155, 200, 171, 0.3))

    .stat-label
      font-size: 0.7rem
      color: #495057
      text-transform: uppercase
      letter-spacing: 0.04em
      font-weight: 600
      line-height: 1.2

    .stat-value
      font-size: 1.35rem
      font-weight: 700
      color: #2d3e33
      line-height: 1.1

    th.sortable
      cursor: pointer
      user-select: none

    th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    th.sorted
      background: rgba(155, 200, 171, 0.45)

    tr.clickable-row
      cursor: pointer

    tr.clickable-row:hover
      background: rgba(155, 200, 171, 0.2)

    .send-action-card
      border: 1px solid rgba(155, 200, 171, 0.45)
      border-radius: 8px
      overflow: hidden
      background: var(--rsm-table-header-bg, #f4f8f5)

    .send-action-header
      display: flex
      align-items: center
      justify-content: space-between
      gap: 1rem
      padding: 0.75rem 1rem
      cursor: pointer

    .send-action-header:hover
      background: rgba(155, 200, 171, 0.25)

    .send-action-title
      min-width: 0

    .origin-badge
      display: inline-block
      font-weight: 600
      border-radius: 999px
      padding: 0.12rem 0.6rem
      margin-right: 0.15rem
      border: 1px solid transparent
      line-height: 1.3

    .origin-badge.origin-inbox-reply
      color: #2d3e33
      background: rgba(155, 200, 171, 0.55)
      border-color: rgba(99, 134, 110, 0.45)

    .origin-badge.origin-composer
      color: #5c4200
      background: rgba(249, 177, 4, 0.3)
      border-color: rgba(211, 150, 3, 0.45)

    .origin-badge.origin-system
      color: #7a3418
      background: rgba(240, 128, 80, 0.28)
      border-color: rgba(240, 128, 80, 0.5)

    .origin-badge.origin-outbound
      color: #404141
      background: rgba(64, 65, 65, 0.1)
      border-color: rgba(64, 65, 65, 0.22)

    .origin-badge.origin-inbox-digest
      color: #495057
      background: rgba(222, 226, 230, 0.85)
      border-color: rgba(108, 117, 125, 0.4)

    .send-action-recipients
      border-radius: 0
      border-left: none
      border-right: none
      border-bottom: none

    .send-action-recipients-table
      table-layout: fixed
      width: 100%

    .send-action-recipients-table .col-recipient
      width: 28%

    .send-action-recipients-table .col-subject
      width: 44%

    .send-action-recipients-table .col-sent
      width: 28%

    .send-action-recipients-table th,
    .send-action-recipients-table td
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .send-action-recipients-table td.sent-cell
      overflow: visible
      white-space: nowrap

    .sent-cell
      display: flex
      align-items: center
      justify-content: space-between
      gap: 0.5rem

    .sent-when
      min-width: 0
      overflow: hidden
      text-overflow: ellipsis

    .action-buttons
      display: inline-flex
      align-items: center
      flex: 0 0 auto
      gap: 0.25rem

    .action-icon-btn
      width: 2rem
      height: 2rem
      min-width: 2rem
      min-height: 2rem
      padding: 0
      display: inline-flex
      align-items: center
      justify-content: center
      line-height: 1
      flex: 0 0 auto

  `]
})
export class MailReportsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailReportsComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private brevoContactService = inject(BrevoContactService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private systemConfigService = inject(SystemConfigService);
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();
  private rangeChangeSubject = new Subject<{startDate: string; endDate: string}>();
  protected summary: BrevoCampaignQueueSummary | null = null;
  protected transactionalStats: BrevoTransactionalAggregatedReport | null = null;
  protected transactionalEmails: BrevoTransactionalEmailSummary[] = [];
  protected transactionalSendGroups: TransactionalSendActionGroup[] = [];
  protected expandedSendActionIds = new Set<string>();
  protected showTransactionalRecipients = false;
  protected showInboxDigests = false;
  protected loadingTransactionalEmails = false;
  protected previewLoadingKey: string | null = null;
  protected emailPreview: {
    summary: BrevoTransactionalEmailSummary;
    loading: boolean;
    error: string | null;
    content: BrevoEmailPreviewContent | null;
  } | null = null;
  protected busy = false;
  protected error: string | null = null;
  protected readonly AdminPath = AdminPath;
  protected readonly StoredValue = StoredValue;
  protected dateRangeLabel = "";
  protected searchTerm = "";
  protected sortField: CampaignSortField | undefined;
  protected sortDirection: SortDirection = SortDirection.DESC;
  protected groupLongName = "";

  protected sliderMinDate: DateTime;
  protected sliderMaxDate: DateTime;
  protected sliderRange: DateRange;
  protected fromDate: DateTime;
  protected toDate: DateTime;

  protected readonly presets = [
    {label: "7d", days: 7},
    {label: "30d", days: 30},
    {label: "90d", days: 90}
  ];
  protected selectedPresetLabel: string;
  protected readonly presetLabels: string[];
  protected readonly CUSTOM_LABEL = "Custom";

  protected reportType: MailReportType = MailReportType.TRANSACTIONAL;
  protected readonly MailReportType = MailReportType;
  protected readonly reportTypeOptions = [
    {label: "Campaigns", value: MailReportType.CAMPAIGNS},
    {label: "Transactional", value: MailReportType.TRANSACTIONAL}
  ];
  protected readonly reportTypeLabels = this.reportTypeOptions.map(option => option.label);
  protected selectedReportTypeLabel = this.reportTypeOptions[1].label;

  protected readonly CampaignSortField = CampaignSortField;
  protected readonly SortDirection = SortDirection;
  protected readonly faRefresh = faRefresh;
  protected readonly faSpinner = faSpinner;
  protected readonly faPlay = faPlay;
  protected readonly faBan = faBan;
  protected readonly faSearch = faSearch;
  protected readonly faSort = faSort;
  protected readonly faSortUp = faSortUp;
  protected readonly faSortDown = faSortDown;
  protected readonly faEnvelopeOpenText = faEnvelopeOpenText;
  protected readonly faInbox = faInbox;

  constructor() {
    this.sliderMaxDate = this.dateUtils.dateTimeNow().startOf("day");
    this.sliderMinDate = this.sliderMaxDate.minus({days: 89});
    this.selectedPresetLabel = this.presets[1].label;
    this.presetLabels = [...this.presets.map(p => p.label), this.CUSTOM_LABEL];
    this.applyPreset(this.presets[1]);
  }

  get sortedCampaigns(): BrevoCampaignProgress[] {
    let campaigns = this.summary?.completedCampaigns ?? [];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      campaigns = campaigns.filter(c =>
        c.subject.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
      );
    }
    if (!this.sortField) return campaigns;
    const direction = this.sortDirection === SortDirection.ASC ? 1 : -1;
    return [...campaigns].sort((a, b) => {
      const aVal = this.sortValue(a, this.sortField!);
      const bVal = this.sortValue(b, this.sortField!);
      if (aVal < bVal) return -1 * direction;
      if (aVal > bVal) return 1 * direction;
      return 0;
    });
  }

  ngOnInit(): void {
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.groupLongName = config?.group?.longName || "";
    }));
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.searchTerm = params[StoredValue.FILTER] || "";
      const reportTypeParam = params[StoredValue.MAIL_REPORT_TYPE];
      const matchedType = this.reportTypeOptions.find(option => option.value === reportTypeParam);
      if (matchedType) {
        this.reportType = matchedType.value;
        this.selectedReportTypeLabel = matchedType.label;
      } else {
        this.reportType = MailReportType.TRANSACTIONAL;
        this.selectedReportTypeLabel = this.reportTypeOptions[1].label;
      }
      const sortParam = params[StoredValue.SORT];
      if (sortParam) {
        this.sortField = sortParam as CampaignSortField;
        this.sortDirection = params[StoredValue.SORT_ORDER] === SortDirection.ASC ? SortDirection.ASC : SortDirection.DESC;
      } else {
        this.sortField = CampaignSortField.SENT_DATE;
        this.sortDirection = SortDirection.DESC;
        this.applyDefaultSortToUrl();
      }
    });
    this.rangeChangeSubject.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(range => {
      void this.loadActiveReport(range.startDate, range.endDate);
    });
    this.setDateRangeLabel(this.fromDate, this.toDate);
    void this.loadActiveReport(this.formattedRangeStart(), this.formattedRangeEnd());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  protected selectPresetByLabel(label: string): void {
    const preset = this.presets.find(candidate => candidate.label === label);
    if (preset) {
      this.selectedPresetLabel = preset.label;
      this.applyPreset(preset);
      this.emitRange();
    } else {
      this.selectedPresetLabel = this.presetLabelForRange(this.sliderRange);
    }
  }

  protected selectReportTypeByLabel(label: string): void {
    const matched = this.reportTypeOptions.find(option => option.label === label);
    if (matched && matched.value !== this.reportType) {
      this.reportType = matched.value;
      this.selectedReportTypeLabel = matched.label;
      this.closeEmailPreview();
      this.updateQueryParams();
      void this.loadActiveReport(this.formattedRangeStart(), this.formattedRangeEnd());
    } else if (matched) {
      this.selectedReportTypeLabel = matched.label;
    } else {
      this.selectedReportTypeLabel = this.reportTypeOptions.find(option => option.value === this.reportType)?.label
        || this.reportTypeOptions[1].label;
    }
  }

  protected onRangeChange(range: DateRange): void {
    this.selectedPresetLabel = this.presetLabelForRange(range);
    this.fromDate = this.dateUtils.asDateTime(range.from);
    this.toDate = this.dateUtils.asDateTime(range.to);
    this.sliderRange = range;
    this.setDateRangeLabel(this.fromDate, this.toDate);
    this.emitRange();
  }

  protected async refresh(): Promise<void> {
    this.setDateRangeLabel(this.fromDate, this.toDate);
    await this.loadActiveReport(this.formattedRangeStart(), this.formattedRangeEnd());
  }

  protected toggleSort(field: CampaignSortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.sortField = field;
      this.sortDirection = SortDirection.DESC;
    }
    this.updateQueryParams();
  }

  protected sortIcon(field: CampaignSortField) {
    if (this.sortField !== field) return faSort;
    return this.sortDirection === SortDirection.ASC ? faSortUp : faSortDown;
  }

  protected updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.MAIL_REPORT_TYPE]: this.reportType,
        [StoredValue.FILTER]: this.searchTerm || null,
        [StoredValue.SORT]: this.sortField || null,
        [StoredValue.SORT_ORDER]: this.sortDirection === SortDirection.DESC ? SortDirection.DESC : SortDirection.ASC
      },
      queryParamsHandling: "merge"
    });
  }

  private applyDefaultSortToUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.MAIL_REPORT_TYPE]: this.reportType,
        [StoredValue.SORT]: CampaignSortField.SENT_DATE,
        [StoredValue.SORT_ORDER]: SortDirection.DESC
      },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  private async loadActiveReport(startDate: string, endDate: string): Promise<void> {
    if (this.reportType === MailReportType.CAMPAIGNS) {
      await this.loadSummary(startDate, endDate);
    } else {
      await this.loadTransactional(startDate, endDate);
    }
  }

  protected openCampaignDrillDown(campaign: BrevoCampaignProgress): void {
    void this.router.navigate(["/" + AdminPath.MAIL_REPORTS_CAMPAIGN], {
      queryParams: { [StoredValue.CAMPAIGN_ID]: campaign.id, [StoredValue.CAMPAIGN_START_DATE]: this.formattedRangeStart(), [StoredValue.CAMPAIGN_END_DATE]: this.formattedRangeEnd() }
    });
  }

  protected toggleTransactionalRecipients(): void {
    this.showTransactionalRecipients = !this.showTransactionalRecipients;
    if (this.showTransactionalRecipients) {
      void this.loadTransactionalEmails(this.formattedRangeStart(), this.formattedRangeEnd());
    } else {
      this.transactionalEmails = [];
      this.transactionalSendGroups = [];
      this.expandedSendActionIds = new Set<string>();
    }
  }

  protected toggleSendActionGroup(groupId: string): void {
    const next = new Set(this.expandedSendActionIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.expandedSendActionIds = next;
  }

  protected previewKey(email: BrevoTransactionalEmailSummary): string {
    return `${email.messageId || ""}|${email.email || ""}|${email.date || ""}`;
  }

  protected inboxThreadQueryParams(threadId: string): Record<string, string> {
    return {[StoredValue.THREAD]: threadId};
  }

  protected async openEmailPreview(email: BrevoTransactionalEmailSummary): Promise<void> {
    const key = this.previewKey(email);
    this.previewLoadingKey = key;
    this.emailPreview = {
      summary: email,
      loading: true,
      error: null,
      content: null
    };
    try {
      const uuid = email.uuid || await this.resolveTransactionalUuid(email);
      if (!uuid) {
        this.emailPreview = {
          summary: email,
          loading: false,
          error: "No stored preview is available for this message in Brevo.",
          content: null
        };
      } else {
        const content = await this.brevoContactService.getTransactionalEmailContent(uuid);
        this.emailPreview = {
          summary: {...email, uuid},
          loading: false,
          error: null,
          content: {
            subject: content?.subject || email.subject || "",
            date: content?.date || email.date,
            body: content?.body || ""
          }
        };
      }
    } catch (error: any) {
      this.logger.warn("Failed to load transactional email preview", error);
      this.emailPreview = {
        summary: email,
        loading: false,
        error: this.errorMessage(error, "Unable to load email content"),
        content: null
      };
    }
    this.previewLoadingKey = null;
  }

  protected closeEmailPreview(): void {
    this.emailPreview = null;
    this.previewLoadingKey = null;
  }

  private async resolveTransactionalUuid(email: BrevoTransactionalEmailSummary): Promise<string | null> {
    if (!email.email || !email.messageId) {
      return null;
    } else {
      const list = await this.brevoContactService.getTransactionalEmails(email.email, {
        messageId: email.messageId,
        limit: 1
      });
      return list?.transactionalEmails?.[0]?.uuid || null;
    }
  }

  get visibleTransactionalSendGroups(): TransactionalSendActionGroup[] {
    if (this.showInboxDigests) {
      return this.transactionalSendGroups;
    } else {
      return this.transactionalSendGroups.filter(group => !this.isInboxDigestGroup(group));
    }
  }

  get hiddenInboxDigestCount(): number {
    return this.transactionalSendGroups.filter(group => this.isInboxDigestGroup(group)).length;
  }

  private isInboxDigestGroup(group: TransactionalSendActionGroup): boolean {
    return group.origin === TransactionalEmailOrigin.INBOX_DIGEST
      || isInboxDigestSubject(group.subjectStem)
      || group.recipients.some(recipient => isInboxDigestSubject(recipient.subject));
  }

  get sendActionSummaryLabel(): string {
    const groups = this.visibleTransactionalSendGroups;
    const recipients = groups.reduce((total, group) => total + group.recipients.length, 0);
    if (groups.length === 0) {
      return "0";
    } else {
      return `${this.stringUtils.pluraliseWithCount(groups.length, "send")}, ${this.stringUtils.pluraliseWithCount(recipients, "recipient")}`;
    }
  }

  protected onShowInboxDigestsChange(show: boolean): void {
    this.showInboxDigests = show;
    if (show) {
      const digestIds = this.transactionalSendGroups
        .filter(group => this.isInboxDigestGroup(group))
        .map(group => group.id);
      this.expandedSendActionIds = new Set([...this.expandedSendActionIds, ...digestIds]);
    }
  }

  get campaignStatTiles(): MailReportStatTile[] {
    const stats = this.summary?.aggregateStats;
    if (!stats || stats.campaignCount <= 0) {
      return [];
    } else {
      return this.tilesWithValues([
        {key: "campaigns", label: "Campaigns", value: stats.campaignCount},
        {key: "sent", label: "Sent", value: stats.totalSent},
        {key: "delivered", label: "Delivered", value: stats.totalDelivered},
        {key: "opens", label: "Opens", value: stats.totalViewed},
        {key: "unique-opens", label: "Unique Opens", value: stats.totalUniqueViews},
        {key: "clicks", label: "Clicks", value: stats.totalUniqueClicks},
        {key: "hard-bounces", label: "Hard Bounces", value: stats.totalHardBounces},
        {key: "soft-bounces", label: "Soft Bounces", value: stats.totalSoftBounces},
        {key: "unsubs", label: "Unsubs", value: stats.totalUnsubscriptions},
        {key: "complaints", label: "Complaints", value: stats.totalComplaints}
      ]);
    }
  }

  get transactionalStatTiles(): MailReportStatTile[] {
    const stats = this.transactionalStats;
    if (!stats) {
      return [];
    } else {
      return this.tilesWithValues([
        {key: "sent", label: "Sent", value: stats.sentCount},
        {key: "delivered", label: "Delivered", value: stats.deliveredCount},
        {key: "opens", label: "Opens", value: stats.openedCount},
        {key: "clicks", label: "Clicks", value: stats.clickedCount},
        {key: "hard-bounces", label: "Hard Bounces", value: stats.hardBouncesCount},
        {key: "soft-bounces", label: "Soft Bounces", value: stats.softBouncesCount},
        {key: "unsubs", label: "Unsubs", value: stats.unsubscribedCount},
        {key: "complaints", label: "Complaints", value: stats.complaintsCount},
        {key: "blocked", label: "Blocked", value: stats.blockedCount}
      ]);
    }
  }

  private tilesWithValues(tiles: MailReportStatTile[]): MailReportStatTile[] {
    return tiles.filter(tile => {
      const numeric = isNumber(tile.value) ? tile.value : Number(tile.value);
      return Number.isFinite(numeric) && numeric > 0;
    });
  }

  private sortValue(campaign: BrevoCampaignProgress, field: CampaignSortField): string | number {
    switch (field) {
      case CampaignSortField.SUBJECT: return campaign.subject.toLowerCase();
      case CampaignSortField.SENT: return campaign.sent;
      case CampaignSortField.DELIVERED: return campaign.delivered;
      case CampaignSortField.VIEWED: return campaign.viewed;
      case CampaignSortField.UNIQUE_VIEWS: return campaign.uniqueViews;
      case CampaignSortField.CLICKS: return campaign.uniqueClicks;
      case CampaignSortField.HARD_BOUNCES: return campaign.hardBounces;
      case CampaignSortField.SOFT_BOUNCES: return campaign.softBounces;
      case CampaignSortField.UNSUBSCRIPTIONS: return campaign.unsubscriptions;
      case CampaignSortField.COMPLAINTS: return campaign.complaints;
      case CampaignSortField.SENT_DATE: return campaign.sentDate || campaign.modifiedAt || "";
    }
  }

  private setDateRangeLabel(from: DateTime, to: DateTime): void {
    this.dateRangeLabel = `${this.dateUtils.asString(from, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED)} to ${this.dateUtils.asString(to, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED)}`;
  }

  private applyPreset(preset: {label: string; days: number}): void {
    this.toDate = this.sliderMaxDate;
    this.fromDate = this.sliderMaxDate.minus({days: preset.days - 1});
    this.sliderRange = {from: this.fromDate.toMillis(), to: this.toDate.toMillis()};
    this.setDateRangeLabel(this.fromDate, this.toDate);
  }

  private presetLabelForRange(range: DateRange): string {
    const toleranceMs = 12 * 60 * 60 * 1000;
    const matchedPreset = this.presets.find(preset => {
      const presetFrom = this.sliderMaxDate.minus({days: preset.days - 1}).toMillis();
      const presetTo = this.sliderMaxDate.toMillis();
      return range.from >= presetFrom - toleranceMs && range.to <= presetTo + toleranceMs;
    });
    return matchedPreset?.label ?? this.CUSTOM_LABEL;
  }

  private emitRange(): void {
    if (!this.showTransactionalRecipients) {
      this.transactionalEmails = [];
      this.transactionalSendGroups = [];
      this.expandedSendActionIds = new Set<string>();
    }
    this.rangeChangeSubject.next({
      startDate: this.formattedRangeStart(),
      endDate: this.formattedRangeEnd()
    });
  }

  private applyTransactionalEmailList(emails: BrevoTransactionalEmailSummary[]): void {
    this.transactionalEmails = emails;
    this.transactionalSendGroups = groupTransactionalEmailsBySendAction(emails);
    this.expandedSendActionIds = new Set(
      this.visibleTransactionalSendGroups.map(group => group.id)
    );
  }

  private async loadSummary(startDate: string, endDate: string): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.summary = await this.mailService.campaignQueueSummary(startDate, endDate);
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to load campaign reports");
    }
    this.busy = false;
  }

  private async loadTransactional(startDate: string, endDate: string): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.transactionalStats = await this.mailService.transactionalAggregatedReport(startDate, endDate);
      if (this.transactionalStats?.sentCount > 0) {
        this.showTransactionalRecipients = true;
        await this.loadTransactionalEmails(startDate, endDate);
      } else {
        this.showTransactionalRecipients = false;
        this.applyTransactionalEmailList([]);
      }
    } catch (error: any) {
      this.logger.warn("Failed to load transactional stats", error);
      this.transactionalStats = null;
      this.showTransactionalRecipients = false;
      this.applyTransactionalEmailList([]);
      this.error = this.errorMessage(error, "Unable to load transactional email statistics");
    }
    this.busy = false;
  }

  private async loadTransactionalEmails(startDate: string, endDate: string): Promise<void> {
    this.loadingTransactionalEmails = true;
    try {
      const response = await this.mailService.transactionalEmails(startDate, endDate);
      this.applyTransactionalEmailList(response?.transactionalEmails ?? []);
      this.error = null;
    } catch (error: any) {
      this.logger.warn("Failed to load transactional emails", error);
      this.applyTransactionalEmailList([]);
      this.error = this.errorMessage(error, "Unable to load transactional recipients");
    }
    this.loadingTransactionalEmails = false;
  }

  protected async release(campaign: BrevoCampaignProgress): Promise<void> {
    this.busy = true;
    try {
      this.summary = await this.mailService.releaseCampaign(campaign.id);
      this.error = null;
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to release campaign");
    }
    this.busy = false;
  }

  protected async cancel(campaign: BrevoCampaignProgress): Promise<void> {
    this.busy = true;
    try {
      this.summary = await this.mailService.cancelCampaign(campaign.id);
      this.error = null;
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to cancel campaign remainder");
    }
    this.busy = false;
  }

  protected formatDate(date: string): string {
    if (date) {
      const dt = this.dateUtils.asDateTime(date);
      return dt.isValid ? this.dateUtils.asString(dt, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED) : date;
    } else {
      return "";
    }
  }

  protected formatDateTime(date: string): string {
    if (date) {
      const dt = this.dateUtils.asDateTime(date);
      return dt.isValid ? this.dateUtils.asString(dt, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED_TIME) : date;
    } else {
      return "";
    }
  }

  private formattedRangeStart(): string {
    return this.fromDate.toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
  }

  private formattedRangeEnd(): string {
    return this.toDate.toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.error?.message
      || error?.error?.error?.body?.message
      || error?.error?.message
      || error?.message
      || fallback;
  }
}
