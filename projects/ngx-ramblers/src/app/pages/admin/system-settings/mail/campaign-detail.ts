import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faPaperPlane, faPenToSquare, faPlus, faSort, faSortDown, faSortUp, faSpinner, faTriangleExclamation, faUsers } from "@fortawesome/free-solid-svg-icons";
import { SortDirection } from "../../../../models/sort.model";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { UIDateFormat } from "../../../../models/date-format.model";
import { AdminPath } from "../../../../models/admin-route-paths.model";
import { BrevoCampaignProgress } from "../../../../models/brevo-campaign-queue.model";
import { CampaignRecipient, MailPerformanceCard, RecipientSortField } from "../../../../models/mail.model";
import { EmailPreviewComponent } from "../../../../modules/common/email-preview/email-preview.component";
import { PageComponent } from "../../../../page/page.component";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";
import { StoredValue } from "../../../../models/ui-actions";

@Component({
  selector: "app-campaign-detail",
  standalone: true,
  imports: [EmailPreviewComponent, FontAwesomeModule, PageComponent, RouterLink],
  template: `
    <app-page [pageTitle]="pageTitle" [showTitle]="false">

      @if (loading) {
        <div class="text-center py-5"><fa-icon [icon]="faSpinner" [animation]="'spin'" size="3x"/></div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (campaign) {
        <div class="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h1 class="mb-1">{{ campaign.subject }}</h1>
            <div class="text-muted campaign-meta-line">
              <span>#{{ campaign.id }}</span>
              @if (campaign.sentDate) {
                <span>Sent {{ formatDateTime(campaign.sentDate) }}</span>
              } @else {
                <span class="text-capitalize">{{ campaign.status }}</span>
              }
            </div>
            @if (campaignDisplayName) {
              <div class="text-muted small mt-1">{{ campaignDisplayName }}</div>
            }
          </div>
          <a [routerLink]="['/' + AdminPath.MAIL_REPORTS]" [queryParams]="backToReportsQueryParams()" class="btn btn-quiet ms-3 text-nowrap campaign-back-button">
            <fa-icon [icon]="faArrowLeft"/> Back
          </a>
        </div>

        @if (campaign.sender?.email || campaign.replyTo) {
          <div class="campaign-detail-meta mb-4">
            @if (campaign.sender?.email) {
              <div>
                <div class="meta-label">From</div>
                <div class="meta-value">{{ senderDisplay }}</div>
              </div>
            }
            @if (campaign.replyTo) {
              <div>
                <div class="meta-label">Reply to</div>
                <div class="meta-value">{{ campaign.replyTo }}</div>
              </div>
            }
          </div>
        }

        <h5 class="section-heading">Campaign performance</h5>
        <div class="performance-grid mb-4">
          @for (card of performanceCards; track card.eventType) {
            <div class="perf-card" [class.selected]="selectedEventType === card.eventType" role="button" [attr.aria-pressed]="selectedEventType === card.eventType" (click)="toggleEventType(card.eventType)">
              <div class="perf-top">
                <span class="perf-value">{{ card.value }}</span>
                <span class="perf-view"><fa-icon [icon]="faUsers"/> View</span>
              </div>
              <div class="perf-label">{{ card.label }}</div>
              <div class="perf-rate-label">{{ card.rateLabel }}</div>
              <div class="perf-rate">{{ card.rate }}</div>
            </div>
          }
        </div>

        @if (selectedEventType) {
          <section class="mb-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h5 class="mb-0">{{ eventSectionTitle }} @if (!loadingRecipients) {<span class="text-muted fw-normal small">({{ recipients.length }})</span>}</h5>
              <button type="button" class="btn btn-sm btn-quiet" (click)="closeRecipients()">
                <fa-icon [icon]="faArrowLeft"/> Back to stats
              </button>
            </div>
            @if (loadingRecipients) {
              <div class="text-center py-4">
                <fa-icon [icon]="faSpinner" [animation]="'spin'" size="2x"/>
                <div class="text-muted small mt-2">Fetching {{ activeEventLabel }} from Brevo…</div>
              </div>
            } @else if (recipients.length > 0) {
              @if (truncated) {
                <div class="alert alert-warning"><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Showing the first {{ recipients.length }} {{ activeEventLabel }}.</div>
              }
              <div class="ngx-data-table-card">
                <table class="ngx-data-table">
                  <thead>
                    <tr>
                      <th class="sortable" [class.sorted]="recipientSortField === RecipientSortField.SUBSCRIBER" (click)="toggleRecipientSort(RecipientSortField.SUBSCRIBER)">Subscriber <fa-icon [icon]="recipientSortIcon(RecipientSortField.SUBSCRIBER)" size="xs"/></th>
                      <th class="sortable" [class.sorted]="recipientSortField === RecipientSortField.DATE" (click)="toggleRecipientSort(RecipientSortField.DATE)">Date <fa-icon [icon]="recipientSortIcon(RecipientSortField.DATE)" size="xs"/></th>
                      @if (selectedEventType === 'clicks') {
                        <th class="sortable" [class.sorted]="recipientSortField === RecipientSortField.CLICKED" (click)="toggleRecipientSort(RecipientSortField.CLICKED)">Clicked <fa-icon [icon]="recipientSortIcon(RecipientSortField.CLICKED)" size="xs"/></th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (recipient of sortedRecipients; track $index) {
                      <tr>
                        <td>
                          @if (recipient.name) {
                            <div class="fw-semibold">{{ recipient.name }}</div>
                            <div class="text-muted small">{{ recipient.email }}</div>
                          } @else {
                            {{ recipient.email }}
                          }
                        </td>
                        <td class="text-nowrap">{{ recipient.date }}</td>
                        @if (selectedEventType === 'clicks') {
                          <td>
                            @if (recipient.links?.length) {
                              @for (link of recipient.links; track link) {
                                <div><a [href]="link" target="_blank" rel="noopener noreferrer">{{ linkLabel(link) }}</a></div>
                              }
                            } @else {
                              <span class="text-muted">—</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="text-muted">No {{ activeEventLabel }} found for this campaign.</p>
            }
          </section>
        }

        <div class="report-body">
          <div class="ngx-data-table-card report-message">
            <div class="panel-header d-flex align-items-center justify-content-between">
              <span>Message</span>
              @if (campaign.sentDate) {
                <span class="text-muted fw-normal">Sent {{ formatDateTime(campaign.sentDate) }}</span>
              }
            </div>
            <app-email-preview [html]="campaignHtml"/>
          </div>

          <div class="report-stats">
            <div class="ngx-data-table-card">
              <div class="panel-header">Delivery breakdown</div>
              <table class="ngx-data-table">
                <tbody>
                  <tr><td>Sent</td><td class="text-end fw-semibold">{{ campaign.sent }}</td></tr>
                  <tr><td class="clickable" (click)="toggleEventType('delivered')">Delivered</td><td class="text-end fw-semibold">{{ campaign.delivered }}</td></tr>
                  <tr><td>Total opens</td><td class="text-end fw-semibold">{{ campaign.viewed }}</td></tr>
                  <tr><td class="clickable" (click)="toggleEventType('hardBounces')">Hard bounces</td><td class="text-end fw-semibold">{{ campaign.hardBounces }}</td></tr>
                  <tr><td class="clickable" (click)="toggleEventType('softBounces')">Soft bounces</td><td class="text-end fw-semibold">{{ campaign.softBounces }}</td></tr>
                  <tr><td>Complaints</td><td class="text-end fw-semibold">{{ campaign.complaints }}</td></tr>
                  <tr><td>Remaining</td><td class="text-end fw-semibold">{{ campaign.remaining }}</td></tr>
                </tbody>
              </table>
            </div>

            <div class="ngx-data-table-card">
              <div class="panel-header">Campaign audience</div>
              @if (campaign.audienceLists && campaign.audienceLists.length > 0) {
                <table class="ngx-data-table">
                  <tbody>
                    @for (list of campaign.audienceLists; track list.id) {
                      <tr>
                        <td>#{{ list.id }} {{ list.name }}</td>
                        <td class="text-end fw-semibold text-nowrap">{{ list.uniqueSubscribers }} contacts</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <div class="p-3 text-muted">No lists recorded for this campaign.</div>
              }
            </div>

            <div class="ngx-data-table-card">
              <div class="panel-header">Timeline</div>
              <ul class="campaign-timeline">
                @if (campaign.sentDate) {
                  <li>
                    <span class="tl-icon"><fa-icon [icon]="faPaperPlane"/></span>
                    <div><div class="tl-title">Sent</div><div class="tl-date">{{ formatDateTime(campaign.sentDate) }}</div></div>
                  </li>
                }
                <li>
                  <span class="tl-icon"><fa-icon [icon]="faPenToSquare"/></span>
                  <div><div class="tl-title">Last modified</div><div class="tl-date">{{ formatDateTime(campaign.modifiedAt) }}</div></div>
                </li>
                <li>
                  <span class="tl-icon"><fa-icon [icon]="faPlus"/></span>
                  <div><div class="tl-title">Created</div><div class="tl-date">{{ formatDateTime(campaign.createdAt) }}</div></div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      }
    </app-page>
  `,
  styles: [`
    .campaign-meta-line
      display: flex
      flex-wrap: wrap
      gap: 0.5rem
      font-size: 0.95rem

    .campaign-meta-line span:not(:first-child)::before
      content: "•"
      margin-right: 0.5rem
      color: #adb5bd

    .campaign-back-button
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 0.35rem

    .campaign-detail-meta
      display: flex
      flex-wrap: wrap
      gap: 2.5rem

    .meta-label
      font-size: 0.7rem
      text-transform: uppercase
      letter-spacing: 0.04em
      font-weight: 600
      color: #6c757d

    .meta-value
      font-weight: 500
      color: #2d3e33

    .section-heading
      font-weight: 600
      margin-bottom: 0.75rem

    .performance-grid
      display: grid
      gap: 16px
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))

    .perf-card
      background: var(--rsm-table-header-bg)
      border: 1px solid rgba(155, 200, 171, 0.4)
      border-radius: 8px
      padding: 1rem 1.1rem
      cursor: pointer
      transition: transform 0.1s, box-shadow 0.1s, border-color 0.1s

    .perf-card:hover
      transform: translateY(-1px)
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)
      border-color: rgba(29, 111, 66, 0.55)

    .perf-card.selected
      border-color: #2d3e33
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.5), rgba(155, 200, 171, 0.3))

    .perf-top
      display: flex
      align-items: baseline
      justify-content: space-between
      gap: 0.5rem

    .perf-value
      font-size: 1.9rem
      font-weight: 700
      color: #2d3e33
      line-height: 1

    .perf-view
      display: inline-flex
      align-items: center
      gap: 0.3rem
      font-size: 0.8rem
      font-weight: 600
      color: #1d6f42

    .perf-label
      margin-top: 0.4rem
      font-weight: 600
      color: #2d3e33

    .perf-rate-label
      margin-top: 0.5rem
      font-size: 0.7rem
      text-transform: uppercase
      letter-spacing: 0.04em
      font-weight: 600
      color: #6c757d

    .perf-rate
      font-size: 1.05rem
      font-weight: 600
      color: #495057

    .report-body
      display: grid
      gap: 16px
      grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr)
      align-items: start
      margin-top: 0.5rem

    .report-stats
      display: flex
      flex-direction: column
      gap: 16px

    .report-message app-email-preview
      display: block

    @media (max-width: 991px)
      .report-body
        grid-template-columns: 1fr

    .panel-header
      background: var(--rsm-table-header-bg)
      color: #495057
      font-weight: 600
      font-size: 0.85rem
      padding: 12px 16px
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)

    .ngx-data-table td.clickable
      cursor: pointer
      color: #1d6f42

    .ngx-data-table td.clickable:hover
      text-decoration: underline

    .ngx-data-table th.sortable
      cursor: pointer
      user-select: none

    .ngx-data-table th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    .ngx-data-table th.sorted
      background: rgba(155, 200, 171, 0.45)

    .campaign-timeline
      list-style: none
      margin: 0
      padding: 16px

    .campaign-timeline li
      display: flex
      align-items: flex-start
      gap: 0.75rem
      padding-bottom: 1rem
      position: relative

    .campaign-timeline li:not(:last-child)::before
      content: ""
      position: absolute
      left: 13px
      top: 28px
      bottom: 0
      width: 1px
      background: rgba(155, 200, 171, 0.6)

    .tl-icon
      display: inline-flex
      align-items: center
      justify-content: center
      width: 28px
      height: 28px
      border-radius: 50%
      background: rgba(155, 200, 171, 0.3)
      color: #1d6f42
      font-size: 0.75rem
      flex-shrink: 0

    .tl-title
      font-weight: 600
      color: #2d3e33

    .tl-date
      font-size: 0.85rem
      color: #6c757d
  `]
})
export class CampaignDetailComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CampaignDetailComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private dateUtils = inject(DateUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  protected campaign: BrevoCampaignProgress | null = null;
  protected campaignHtml: string | null = null;
  protected pageTitle = "Campaign Details";
  protected loading = true;
  protected error: string | null = null;

  protected selectedEventType: string | null = null;
  protected recipients: CampaignRecipient[] = [];
  protected loadingRecipients = false;
  protected truncated = false;
  protected readonly RecipientSortField = RecipientSortField;
  protected recipientSortField: RecipientSortField = RecipientSortField.SUBSCRIBER;
  protected recipientSortDirection: SortDirection = SortDirection.ASC;

  private campaignId: number | null = null;
  protected startDate: string | null = null;
  protected endDate: string | null = null;

  protected backToReportsQueryParams(): Record<string, string | null> {
    return {[StoredValue.CAMPAIGN_START_DATE]: this.startDate, [StoredValue.CAMPAIGN_END_DATE]: this.endDate};
  }

  private readonly eventTypeLabels: Record<string, string> = {
    delivered: "Delivered",
    opened: "Opens",
    clicks: "Clicks",
    unsubscribed: "Unsubscribes",
    hardBounces: "Hard bounces",
    softBounces: "Soft bounces"
  };

  private readonly recipientNouns: Record<string, string> = {
    delivered: "delivered recipients",
    opened: "openers",
    clicks: "clickers",
    unsubscribed: "unsubscribers",
    hardBounces: "hard bounces",
    softBounces: "soft bounces"
  };

  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faSpinner = faSpinner;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faUsers = faUsers;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faPlus = faPlus;
  protected readonly AdminPath = AdminPath;

  get performanceCards(): MailPerformanceCard[] {
    const c = this.campaign;
    if (!c) {
      return [];
    } else {
      return [
        {label: "Delivered", value: c.delivered, rate: this.deliveryRate(), rateLabel: "Delivery rate", eventType: "delivered"},
        {label: "Opens", value: c.uniqueViews, rate: this.openRate(), rateLabel: "Open rate", eventType: "opened"},
        {label: "Clicks", value: c.uniqueClicks, rate: this.clickRate(), rateLabel: "Click-through rate", eventType: "clicks"},
        {label: "Unsubscribes", value: c.unsubscriptions, rate: this.unsubscribeRate(), rateLabel: "Unsubscribe rate", eventType: "unsubscribed"}
      ];
    }
  }

  get senderDisplay(): string {
    const name = this.campaign?.sender?.name?.trim() ?? "";
    const email = this.campaign?.sender?.email?.trim() ?? "";
    if (name && email) {
      return `${name} <${email}>`;
    } else {
      return name || email;
    }
  }

  get eventSectionTitle(): string {
    const label = this.eventTypeLabels[this.selectedEventType ?? ""];
    return label ?? "Recipients";
  }

  get activeEventLabel(): string {
    return this.recipientNouns[this.selectedEventType ?? ""] ?? "recipients";
  }

  get campaignDisplayName(): string {
    const subject = this.campaign?.subject?.trim() ?? "";
    const name = this.campaign?.name?.trim() ?? "";
    if (!name || name.toLowerCase().includes(subject.toLowerCase())) {
      return "";
    } else {
      return name;
    }
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.startDate = params[StoredValue.CAMPAIGN_START_DATE] || null;
      this.endDate = params[StoredValue.CAMPAIGN_END_DATE] || null;
      const campaignId = Number(params[StoredValue.CAMPAIGN_ID]);
      if (!Number.isFinite(campaignId)) {
        this.error = "Invalid campaign ID";
        this.loading = false;
        return;
      }
      this.campaignId = campaignId;
      void this.loadCampaign(campaignId);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected closeRecipients(): void {
    this.selectedEventType = null;
    this.recipients = [];
    this.truncated = false;
  }

  get sortedRecipients(): CampaignRecipient[] {
    const direction = this.recipientSortDirection === SortDirection.ASC ? 1 : -1;
    const field = this.recipientSortField;
    return [...this.recipients].sort((left, right) => {
      const leftValue = this.recipientSortValue(left, field);
      const rightValue = this.recipientSortValue(right, field);
      if (leftValue < rightValue) {
        return -direction;
      } else if (leftValue > rightValue) {
        return direction;
      } else {
        return 0;
      }
    });
  }

  private recipientSortValue(recipient: CampaignRecipient, field: RecipientSortField): string {
    if (field === RecipientSortField.SUBSCRIBER) {
      return (recipient.name || recipient.email || "").toLowerCase();
    } else if (field === RecipientSortField.CLICKED) {
      return (recipient.links ?? []).join(" ").toLowerCase();
    } else {
      return this.sortableDate(recipient.date);
    }
  }

  private sortableDate(date: string): string {
    const match = /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(date ?? "");
    if (match) {
      return `${match[3]}${match[2]}${match[1]}${match[4]}${match[5]}${match[6]}`;
    } else {
      return date ?? "";
    }
  }

  protected toggleRecipientSort(field: RecipientSortField): void {
    if (this.recipientSortField === field) {
      this.recipientSortDirection = this.recipientSortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.recipientSortField = field;
      this.recipientSortDirection = SortDirection.ASC;
    }
  }

  protected recipientSortIcon(field: RecipientSortField) {
    if (this.recipientSortField !== field) {
      return faSort;
    } else {
      return this.recipientSortDirection === SortDirection.ASC ? faSortUp : faSortDown;
    }
  }

  protected toggleEventType(eventType: string): void {
    if (this.selectedEventType === eventType) {
      this.closeRecipients();
    } else {
      this.selectedEventType = eventType;
      void this.loadRecipients(eventType);
    }
  }

  private async loadRecipients(eventType: string): Promise<void> {
    if (!this.campaignId) return;
    this.loadingRecipients = true;
    this.recipients = [];
    this.truncated = false;
    try {
      const report = await this.mailService.campaignRecipients(this.campaignId, eventType);
      if (this.selectedEventType !== eventType) {
        return;
      }
      this.recipients = report.recipients || [];
      this.truncated = report.truncated;
    } catch (error: any) {
      this.logger.warn("Failed to load campaign recipients", error);
      if (this.selectedEventType === eventType) {
        this.recipients = [];
      }
    } finally {
      if (this.selectedEventType === eventType) {
        this.loadingRecipients = false;
      }
    }
  }

  private async loadCampaign(campaignId: number): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.campaign = await this.mailService.campaignStats(campaignId);
      void this.loadContent(campaignId);
    } catch (error: any) {
      this.logger.warn("Failed to load campaign stats", error);
      this.error = error?.error?.message || error?.message || "Failed to load campaign stats";
    }
    this.loading = false;
  }

  private async loadContent(campaignId: number): Promise<void> {
    try {
      const content = await this.mailService.campaignContent(campaignId);
      this.campaignHtml = content.htmlContent || null;
    } catch (error: any) {
      this.logger.warn("Failed to load campaign content", error);
      this.campaignHtml = null;
    }
  }

  protected linkLabel(url: string): string {
    return url.replace(/^https?:\/\//i, "");
  }

  protected formatDateTime(date: string): string {
    if (date) {
      return this.dateUtils.asString(date, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED_TIME);
    } else {
      return "";
    }
  }

  protected deliveryRate(): string {
    return this.percentage(this.campaign?.delivered ?? 0, this.campaign?.sent ?? 0);
  }

  protected openRate(): string {
    return this.percentage(this.campaign?.uniqueViews ?? 0, this.campaign?.delivered ?? 0);
  }

  protected clickRate(): string {
    return this.percentage(this.campaign?.uniqueClicks ?? 0, this.campaign?.delivered ?? 0);
  }

  protected unsubscribeRate(): string {
    return this.percentage(this.campaign?.unsubscriptions ?? 0, this.campaign?.delivered ?? 0);
  }

  private percentage(value: number, total: number): string {
    if (total > 0) {
      return `${parseFloat(((value / total) * 100).toFixed(2))}%`;
    } else {
      return "0%";
    }
  }
}
