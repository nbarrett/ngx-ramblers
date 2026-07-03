import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBan, faChartLine, faPlay, faRefresh, faSearch, faSort, faSortDown, faSortUp, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { DateTime } from "luxon";
import { Subject, Subscription } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { BrevoCampaignProgress, BrevoCampaignQueueSummary } from "../../../../models/brevo-campaign-queue.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { AdminPath } from "../../../../models/admin-route-paths.model";
import { BrevoTransactionalAggregatedReport, BrevoTransactionalEmailSummary } from "../../../../models/mail.model";
import { SortDirection } from "../../../../models/sort.model";
import { StoredValue } from "../../../../models/ui-actions";
import { PageComponent } from "../../../../page/page.component";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { MailService } from "../../../../services/mail/mail.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SectionToggle } from "../../../../shared/components/section-toggle";
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

@Component({
  selector: "app-mail-reports",
  standalone: true,
  imports: [DateRangeSlider, FontAwesomeModule, FormsModule, PageComponent, SectionToggle],
  template: `
    <app-page autoTitle>
      <p>Brevo campaign and transactional email statistics.</p>
      <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
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
      @if (summary) {
        <h5 class="mt-3">Campaign Activity</h5>
        @if (summary.aggregateStats) {
          <div class="row mb-3 g-2">
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.campaignCount }}</div><div class="stat-label">Campaigns</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalSent }}</div><div class="stat-label">Sent</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalDelivered }}</div><div class="stat-label">Delivered</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalViewed }}</div><div class="stat-label">Opens</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalUniqueViews }}</div><div class="stat-label">Unique Opens</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalUniqueClicks }}</div><div class="stat-label">Clicks</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalHardBounces }}</div><div class="stat-label">Hard Bounces</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalSoftBounces }}</div><div class="stat-label">Soft Bounces</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalUnsubscriptions }}</div><div class="stat-label">Unsubs</div></div></div>
            <div class="col"><div class="stat-tile"><div class="stat-value">{{ summary.aggregateStats.totalComplaints }}</div><div class="stat-label">Complaints</div></div></div>
          </div>
        }

        @if (transactionalStats) {
          <h5 class="mt-3">Transactional Email Activity</h5>
          <div class="row mb-3 g-2">
            <div class="col clickable" (click)="toggleTransactionalRecipients()" role="button">
              <div class="stat-tile" [class.selected]="showTransactionalRecipients"><div class="stat-value">{{ transactionalStats.sentCount }}</div><div class="stat-label">Sent</div></div>
            </div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.deliveredCount }}</div><div class="stat-label">Delivered</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.openedCount }}</div><div class="stat-label">Opens</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.clickedCount }}</div><div class="stat-label">Clicks</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.hardBouncesCount }}</div><div class="stat-label">Hard Bounces</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.softBouncesCount }}</div><div class="stat-label">Soft Bounces</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.unsubscribedCount }}</div><div class="stat-label">Unsubs</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.complaintsCount }}</div><div class="stat-label">Complaints</div></div></div>
            <div class="col not-clickable"><div class="stat-tile"><div class="stat-value">{{ transactionalStats.blockedCount }}</div><div class="stat-label">Blocked</div></div></div>
          </div>
          @if (showTransactionalRecipients) {
            <section class="mb-4">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h5 class="mb-0">Recent Transactional Recipients <span class="text-muted fw-normal small">({{ transactionalEmails.length }})</span></h5>
                @if (loadingTransactionalEmails) {
                  <span class="text-muted small"><fa-icon [icon]="faSpinner" [animation]="'spin'"/> Loading</span>
                }
              </div>
              @if (transactionalEmails.length > 0) {
                <div class="ngx-data-table-card">
                  <table class="ngx-data-table">
                    <thead>
                      <tr><th>Recipient</th><th>Subject</th><th>Sent</th><th>Message ID</th></tr>
                    </thead>
                    <tbody>
                      @for (email of transactionalEmails; track email.uuid || email.messageId) {
                        <tr>
                          <td>{{ email.email }}</td>
                          <td>{{ email.subject }}</td>
                          <td>{{ formatDate(email.date) }}</td>
                          <td>{{ email.messageId }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else if (!loadingTransactionalEmails) {
                <p class="text-muted">No transactional recipient records were found in this period.</p>
              }
            </section>
          }
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
    </app-page>
  `,
  styles: [`
    .stat-tile
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
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

    .col.not-clickable .stat-tile
      opacity: 0.72

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
  `]
})
export class MailReportsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailReportsComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private systemConfigService = inject(SystemConfigService);
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();
  private rangeChangeSubject = new Subject<{startDate: string; endDate: string}>();
  protected summary: BrevoCampaignQueueSummary | null = null;
  protected transactionalStats: BrevoTransactionalAggregatedReport | null = null;
  protected transactionalEmails: BrevoTransactionalEmailSummary[] = [];
  protected showTransactionalRecipients = false;
  protected loadingTransactionalEmails = false;
  protected busy = false;
  protected error: string | null = null;
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
      void this.loadSummary(range.startDate, range.endDate);
      void this.loadTransactional(range.startDate, range.endDate);
    });
    this.setDateRangeLabel(this.fromDate, this.toDate);
    void this.loadSummary(this.formattedRangeStart(), this.formattedRangeEnd());
    void this.loadTransactional(this.formattedRangeStart(), this.formattedRangeEnd());
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
    await Promise.all([
      this.loadSummary(this.formattedRangeStart(), this.formattedRangeEnd()),
      this.loadTransactional(this.formattedRangeStart(), this.formattedRangeEnd())
    ]);
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
        [StoredValue.SORT]: CampaignSortField.SENT_DATE,
        [StoredValue.SORT_ORDER]: SortDirection.DESC
      },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  protected openCampaignDrillDown(campaign: BrevoCampaignProgress): void {
    void this.router.navigate(["/" + AdminPath.MAIL_REPORTS_CAMPAIGN], {
      queryParams: { [StoredValue.CAMPAIGN_ID]: campaign.id, [StoredValue.CAMPAIGN_START_DATE]: this.formattedRangeStart(), [StoredValue.CAMPAIGN_END_DATE]: this.formattedRangeEnd() }
    });
  }

  protected toggleTransactionalRecipients(): void {
    this.showTransactionalRecipients = !this.showTransactionalRecipients;
    if (this.showTransactionalRecipients && this.transactionalEmails.length === 0) {
      void this.loadTransactionalEmails(this.formattedRangeStart(), this.formattedRangeEnd());
    }
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
    this.transactionalEmails = [];
    this.rangeChangeSubject.next({
      startDate: this.formattedRangeStart(),
      endDate: this.formattedRangeEnd()
    });
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
    try {
      this.transactionalStats = await this.mailService.transactionalAggregatedReport(startDate, endDate);
    } catch (error: any) {
      this.logger.warn("Failed to load transactional stats", error);
    }
  }

  private async loadTransactionalEmails(startDate: string, endDate: string): Promise<void> {
    this.loadingTransactionalEmails = true;
    try {
      const response = await this.mailService.transactionalEmails(startDate, endDate);
      this.transactionalEmails = response.transactionalEmails ?? [];
    } catch (error: any) {
      this.logger.warn("Failed to load transactional emails", error);
      this.transactionalEmails = [];
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
