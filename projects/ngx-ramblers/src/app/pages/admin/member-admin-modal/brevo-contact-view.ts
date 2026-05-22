import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowsRotate, faChevronDown, faChevronUp, faEnvelopeOpen, faExternalLinkAlt, faHandPointer, faPaperPlane, faSquareCheck, faTriangleExclamation, faUserSlash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { BrevoContactService } from "../../../services/mail/brevo-contact.service";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import {
  BREVO_EVENT_LABELS,
  BrevoContactCampaignStats,
  BrevoEmailEvent,
  BrevoEventType,
  BrevoTransactionalEmailContent,
  ListInfo,
  MailMessagingConfig
} from "../../../models/mail.model";
import { BrevoContactViewState, BrevoEventGroup, BrevoStatTile } from "./brevo-contact-view.model";

@Component({
  selector: "app-brevo-contact-view",
  imports: [FontAwesomeModule],
  template: `
    <div>
      <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
        @if (contactEmail) {
          <button type="button" class="btn btn-sm btn-outline-secondary"
                  [disabled]="state.loading"
                  (click)="refresh()">
            <fa-icon [icon]="faArrowsRotate" class="me-1"></fa-icon>
            Refresh
          </button>
        }
        @if (contactId) {
          <a class="btn btn-sm btn-outline-secondary"
             target="_blank"
             rel="noopener"
             [href]="brevoLink()">
            <fa-icon [icon]="faExternalLinkAlt" class="me-1"></fa-icon>
            Open in Brevo
          </a>
        } @else {
          <span class="text-muted small">Contact not in Brevo - email activity history shown below where available</span>
        }
      </div>

      @if (state.error) {
        <div class="alert alert-danger small mb-3">{{ state.error }}</div>
      }
      @if (contactId) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Channels</div>
          <div class="col-sm-12">
              @if (state.loading && !state.contactDetails) {
                <div class="text-muted small">Loading...</div>
              } @else if (state.contactDetails) {
                <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                  <span class="badge"
                        [class.bg-success]="!state.contactDetails.emailBlacklisted"
                        [class.bg-danger]="state.contactDetails.emailBlacklisted">
                    {{ state.contactDetails.emailBlacklisted ? "Email blacklisted" : "Subscribed" }}
                  </span>
                  <span class="badge bg-secondary">Email campaigns</span>
                  <span class="badge bg-secondary">Transactional emails</span>
                  @if (state.contactDetails.smsBlacklisted) {
                    <span class="badge bg-warning text-dark">SMS blacklisted</span>
                  }
                </div>
                <dl class="row small mb-0">
                  <dt class="col-sm-4">Lists</dt>
                  <dd class="col-sm-8">{{ listSummary() }}</dd>
                  <dt class="col-sm-4">Brevo ID</dt>
                  <dd class="col-sm-8">{{ state.contactDetails.id }}</dd>
                  <dt class="col-sm-4">Created</dt>
                  <dd class="col-sm-8">{{ formatIso(state.contactDetails.createdAt) }}</dd>
                  <dt class="col-sm-4">Modified</dt>
                  <dd class="col-sm-8">{{ formatIso(state.contactDetails.modifiedAt) }}</dd>
                </dl>
              }
          </div>
        </div>
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Email campaigns</div>
          <div class="col-sm-12">
              @if (state.loading && !state.campaignStats) {
                <div class="text-muted small">Loading...</div>
              } @else if (state.campaignStats) {
                <div class="row g-2">
                  @for (tile of statTiles(); track tile.key) {
                    <div class="col-4">
                      <div class="text-muted small">{{ tile.label }}</div>
                      <div class="fw-bold fs-5">{{ tile.value }}</div>
                    </div>
                  }
                </div>
                <div class="text-muted small mt-2">Campaign-level totals. Transactional sends appear in the timeline below.</div>
              }
          </div>
        </div>
      }

      @if (contactEmail) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Recent history ({{ state.events.length }} event{{ state.events.length === 1 ? "" : "s" }})</div>
          <div class="col-sm-12">
          @if (archivedSnapshotAt) {
            <div class="text-muted small fst-italic mb-2">Archived snapshot - contact has been deleted from Brevo. Captured {{ archivedDateTime() }}.</div>
          }
          <div>
          @if (state.loading && state.events.length === 0) {
            <div class="text-muted small">Loading...</div>
          } @else if (state.events.length === 0) {
            <div class="text-muted small">No transactional events in the last {{ state.eventsDays }} days.</div>
          } @else {
            @for (group of eventGroups(); track group.label) {
              <div class="mb-2">
                <div class="text-muted small mb-1">{{ group.label }}</div>
                @for (event of group.events; track $index) {
                  <div class="d-flex">
                    <div class="position-relative flex-shrink-0 me-3" style="width: 12px;">
                      <span class="position-absolute"
                            style="left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-50%); background-color: #dee2e6;"></span>
                      <span class="position-absolute rounded-circle"
                            [style.background-color]="eventColor(event.event).bg"
                            style="width: 10px; height: 10px; left: 50%; top: 0.7rem; transform: translate(-50%, -50%);"></span>
                    </div>
                    <div class="flex-grow-1 pb-2" style="min-width: 0;">
                    <div class="d-flex align-items-baseline gap-2 lh-sm">
                      <span class="badge flex-shrink-0"
                            [style.background-color]="eventColor(event.event).bg"
                            [style.color]="eventColor(event.event).text">
                        <fa-icon [icon]="iconFor(event.event)" class="me-1"></fa-icon>
                        {{ labelFor(event.event) }}
                      </span>
                      <span class="small">@if (event.subject) {<span class="fw-semibold">{{ event.subject }}</span> &middot; }<span class="text-muted">{{ formatIso(event.date) }}@if (event.from) {<span> &middot; from {{ fromLabel(event.from) }}</span>}</span></span>
                    </div>
                    @if (event.reason) {
                      <div class="small text-danger">{{ event.reason }}</div>
                    }
                    @if (event.link) {
                      <div class="small text-truncate">
                        <a [href]="event.link" target="_blank" rel="noopener">{{ event.link }}</a>
                      </div>
                    }
                    @if (canPreview(event)) {
                      <button type="button" class="btn btn-sm btn-link p-0 small"
                              (click)="togglePreview(event)">
                        <fa-icon [icon]="previewedEventKey === eventKey(event) ? faChevronUp : faChevronDown" class="me-1"></fa-icon>
                        {{ previewedEventKey === eventKey(event) ? "Hide preview" : "Preview email" }}
                      </button>
                      @if (previewedEventKey === eventKey(event)) {
                        @if (previewState.loading) {
                          <div class="text-muted small mt-1">Loading preview...</div>
                        } @else if (previewState.error) {
                          <div class="alert alert-warning small mt-1 mb-0">{{ previewState.error }}</div>
                        } @else if (previewState.content) {
                          <div class="border rounded p-2 mt-1 bg-light">
                            <div class="small text-muted">Sent {{ formatIso(previewState.content.date) }}</div>
                            <div class="fw-semibold mb-2">{{ previewState.content.subject }}</div>
                            <iframe [srcdoc]="safePreviewBody"
                                    sandbox=""
                                    style="width: 100%; min-height: 320px; border: 1px solid #ddd; background: white;"></iframe>
                          </div>
                        }
                      }
                    }
                    </div>
                  </div>
                }
              </div>
            }
            @if (state.canLoadMore) {
              <button type="button" class="btn btn-sm btn-outline-secondary"
                      [disabled]="state.loadingMore"
                      (click)="loadMore()">
                {{ state.loadingMore ? "Loading..." : "Load older events" }}
              </button>
            }
          }
          </div>
          </div>
        </div>
      }
    </div>
  `
})
export class BrevoContactViewComponent implements OnChanges {

  private logger: Logger = inject(LoggerFactory).createLogger("BrevoContactViewComponent", NgxLoggerLevel.ERROR);
  private brevoContactService = inject(BrevoContactService);
  private dateUtils = inject(DateUtilsService);
  private sanitizer = inject(DomSanitizer);
  private mailLinkService = inject(MailLinkService);

  @Input() contactId: number | null = null;
  @Input() contactEmail: string | null = null;
  @Input() mailMessagingConfig: MailMessagingConfig | null = null;
  @Output() refreshed = new EventEmitter<void>();

  protected state: BrevoContactViewState = {
    loading: false,
    loadingMore: false,
    canLoadMore: false,
    eventsDays: 90,
    eventsLimit: 50,
    events: [],
    contactDetails: null,
    campaignStats: null,
    error: null
  };
  protected archivedSnapshotAt: number | null = null;
  protected previewedEventKey: string | null = null;
  protected previewState: { loading: boolean; error: string | null; content: BrevoTransactionalEmailContent | null } = { loading: false, error: null, content: null };
  protected safePreviewBody: SafeHtml | null = null;
  private previewKeyCache: { events: BrevoEmailEvent[]; keys: Set<string> } | null = null;

  protected readonly faArrowsRotate = faArrowsRotate;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  private readonly EVENT_ICONS: Record<string, any> = {
    [BrevoEventType.REQUESTS]: faPaperPlane,
    [BrevoEventType.DELIVERED]: faSquareCheck,
    [BrevoEventType.OPENED]: faEnvelopeOpen,
    [BrevoEventType.CLICKS]: faHandPointer,
    [BrevoEventType.HARD_BOUNCES]: faTriangleExclamation,
    [BrevoEventType.SOFT_BOUNCES]: faTriangleExclamation,
    [BrevoEventType.BOUNCES]: faTriangleExclamation,
    [BrevoEventType.SPAM]: faTriangleExclamation,
    [BrevoEventType.BLOCKED]: faTriangleExclamation,
    [BrevoEventType.ERROR]: faTriangleExclamation,
    [BrevoEventType.UNSUBSCRIBED]: faUserSlash
  };
  private readonly EVENT_COLORS: Record<string, { bg: string; text: string }> = {
    [BrevoEventType.REQUESTS]: { bg: "#8a94a6", text: "#ffffff" },
    [BrevoEventType.DELIVERED]: { bg: "#3578c6", text: "#ffffff" },
    [BrevoEventType.OPENED]: { bg: "#1eb3a7", text: "#ffffff" },
    [BrevoEventType.CLICKS]: { bg: "#6f42c1", text: "#ffffff" },
    [BrevoEventType.HARD_BOUNCES]: { bg: "#dc3545", text: "#ffffff" },
    [BrevoEventType.SOFT_BOUNCES]: { bg: "#f0ad4e", text: "#212529" },
    [BrevoEventType.BOUNCES]: { bg: "#dc3545", text: "#ffffff" },
    [BrevoEventType.SPAM]: { bg: "#dc3545", text: "#ffffff" },
    [BrevoEventType.BLOCKED]: { bg: "#dc3545", text: "#ffffff" },
    [BrevoEventType.ERROR]: { bg: "#dc3545", text: "#ffffff" },
    [BrevoEventType.UNSUBSCRIBED]: { bg: "#343a40", text: "#ffffff" }
  };
  private readonly DEFAULT_EVENT_COLOR = { bg: "#8a94a6", text: "#ffffff" };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["contactId"] || changes["contactEmail"]) {
      this.resetState();
      if (this.contactEmail) {
        void this.loadAll();
      }
    }
  }

  protected refresh(): void {
    if (this.contactEmail) {
      this.resetState();
      void this.loadAll();
    }
    this.refreshed.emit();
  }

  protected listSummary(): string {
    const ids = this.state.contactDetails?.listIds || [];
    if (ids.length === 0) return "None";
    const lists: ListInfo[] = this.mailMessagingConfig?.brevo?.lists?.lists || [];
    const named = ids.map((id: number) => lists.find(list => list.id === id)?.name || `#${id}`);
    return named.join(", ");
  }

  protected statTiles(): BrevoStatTile[] {
    const stats: BrevoContactCampaignStats | null = this.state.campaignStats;
    if (!stats) return [];
    const sent = stats.messagesSent?.length ?? 0;
    const delivered = stats.delivered?.length ?? 0;
    const opened = stats.opened?.reduce((acc, item) => acc + (item.count ?? 1), 0) ?? 0;
    const clicked = stats.clicked?.reduce((acc, item) => acc + (item.links?.reduce((sum, link) => sum + (link.count ?? 1), 0) ?? 0), 0) ?? 0;
    const bounced = (stats.hardBounces?.length ?? 0) + (stats.softBounces?.length ?? 0);
    const unsubscribed = (stats.unsubscriptions?.userUnsubscription?.length ?? 0) + (stats.unsubscriptions?.adminUnsubscription?.length ?? 0);
    return [
      { key: "sent", label: "Sent", value: sent },
      { key: "delivered", label: "Delivered", value: delivered },
      { key: "opened", label: "Opened", value: opened },
      { key: "clicked", label: "Clicked", value: clicked },
      { key: "bounced", label: "Bounced", value: bounced },
      { key: "unsubscribed", label: "Unsubscribed", value: unsubscribed }
    ];
  }

  protected eventGroups(): BrevoEventGroup[] {
    const groups = new Map<string, BrevoEmailEvent[]>();
    const labelByKey = new Map<string, string>();
    for (const event of this.state.events) {
      const key = this.dayKey(event.date);
      const existing = groups.get(key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(key, [event]);
        labelByKey.set(key, this.dayLabel(event.date));
      }
    }
    return Array.from(groups.entries()).map(([key, events]) => ({ label: labelByKey.get(key) || key, events }));
  }

  protected labelFor(eventType: string): string {
    return BREVO_EVENT_LABELS[eventType] || eventType;
  }

  protected iconFor(eventType: string): any {
    return this.EVENT_ICONS[eventType] || faPaperPlane;
  }

  protected eventColor(eventType: string): { bg: string; text: string } {
    return this.EVENT_COLORS[eventType] || this.DEFAULT_EVENT_COLOR;
  }

  protected formatIso(value: string | undefined): string {
    if (!value) return "";
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return this.dateUtils.displayDateAndTime(parsed);
  }

  protected brevoLink(): string {
    return this.contactId ? this.mailLinkService.contactView(this.contactId) : "";
  }

  protected archivedDateTime(): string {
    return this.archivedSnapshotAt ? this.dateUtils.displayDateAndTime(this.archivedSnapshotAt) : "";
  }

  protected fromLabel(from: string | undefined): string {
    if (!from) {
      return "";
    }
    const committeeMembers = this.mailMessagingConfig?.committeeReferenceData?.committeeMembers?.() ?? [];
    const match = committeeMembers.find(member => member.email?.toLowerCase() === from.toLowerCase());
    return match?.description || match?.fullName || from;
  }

  protected eventKey(event: BrevoEmailEvent): string {
    return `${event.messageId}|${event.event}|${event.date}`;
  }

  protected canPreview(event: BrevoEmailEvent): boolean {
    if (!event.messageId) {
      return false;
    }
    if (this.previewKeyCache?.events !== this.state.events) {
      this.previewKeyCache = { events: this.state.events, keys: this.firstEventKeyPerMessage() };
    }
    return this.previewKeyCache.keys.has(this.eventKey(event));
  }

  private firstEventKeyPerMessage(): Set<string> {
    const seenMessages = new Set<string>();
    const keys = new Set<string>();
    this.state.events.forEach(event => {
      if (event.messageId && !seenMessages.has(event.messageId)) {
        seenMessages.add(event.messageId);
        keys.add(this.eventKey(event));
      }
    });
    return keys;
  }

  protected async togglePreview(event: BrevoEmailEvent): Promise<void> {
    const key = this.eventKey(event);
    if (this.previewedEventKey === key) {
      this.previewedEventKey = null;
      this.previewState = { loading: false, error: null, content: null };
      this.safePreviewBody = null;
      return;
    }
    this.previewedEventKey = key;
    this.previewState = { loading: true, error: null, content: null };
    this.safePreviewBody = null;
    if (!this.contactEmail) {
      this.previewState = { loading: false, error: "No email address on member - cannot fetch preview", content: null };
      return;
    }
    try {
      const list = await this.brevoContactService.getTransactionalEmails(this.contactEmail, { messageId: event.messageId, limit: 1 });
      const summary = list?.transactionalEmails?.[0];
      if (!summary?.uuid) {
        this.previewState = { loading: false, error: "No stored preview available for this message", content: null };
        return;
      }
      const content = await this.brevoContactService.getTransactionalEmailContent(summary.uuid);
      this.previewState = { loading: false, error: null, content };
      this.safePreviewBody = content?.body ? this.sanitizer.bypassSecurityTrustHtml(content.body) : null;
    } catch (error: any) {
      this.logger.warn("preview fetch failed", error);
      this.previewState = { loading: false, error: this.errorMessage(error), content: null };
    }
  }

  protected async loadMore(): Promise<void> {
    if (!this.contactEmail || this.state.loadingMore) return;
    this.state = { ...this.state, loadingMore: true };
    try {
      const offset = this.state.events.length;
      const report = await this.brevoContactService.getEmailEventReport(this.contactEmail, { days: this.state.eventsDays, limit: this.state.eventsLimit, offset });
      const newEvents = report?.events || [];
      this.state = {
        ...this.state,
        events: [...this.state.events, ...newEvents],
        canLoadMore: newEvents.length === this.state.eventsLimit,
        loadingMore: false
      };
    } catch (error: any) {
      this.logger.warn("loadMore failed", error);
      this.state = { ...this.state, loadingMore: false, error: this.errorMessage(error) };
    }
  }

  private async loadAll(): Promise<void> {
    if (!this.contactEmail) {
      this.state = { ...this.state, error: "Member has no email - cannot fetch Brevo activity" };
      return;
    }
    this.state = { ...this.state, loading: true, error: null };
    this.archivedSnapshotAt = null;
    try {
      const [details, stats, report] = await Promise.all([
        this.brevoContactService.getContactInfo(this.contactEmail).catch(error => this.swallowError("contact info", error)),
        this.brevoContactService.getContactCampaignStats(this.contactEmail).catch(error => this.swallowError("campaign stats", error)),
        this.brevoContactService.getEmailEventReport(this.contactEmail, { days: this.state.eventsDays, limit: this.state.eventsLimit, offset: 0 }).catch(error => this.captureError("event report", error))
      ]);
      const liveEvents = report?.events || [];
      const liveDetails = details || null;
      const liveStats = stats || null;
      const useSnapshot = liveEvents.length === 0 && !liveDetails && !this.contactId;
      const snapshot = useSnapshot
        ? await this.brevoContactService.getContactSnapshot(this.contactEmail).catch(error => this.swallowError("snapshot", error))
        : null;
      const events = snapshot?.events ?? liveEvents;
      this.archivedSnapshotAt = snapshot?.snapshotAt ?? null;
      this.state = {
        ...this.state,
        loading: false,
        contactDetails: snapshot?.contactDetails ?? liveDetails,
        campaignStats: snapshot?.campaignStats ?? liveStats,
        events,
        canLoadMore: !snapshot && events.length === this.state.eventsLimit
      };
    } catch (error: any) {
      this.logger.warn("loadAll failed", error);
      this.state = { ...this.state, loading: false, error: this.errorMessage(error) };
    }
  }

  private captureError(label: string, error: any): null {
    this.logger.warn(`${label} failed`, error);
    const message = this.errorMessage(error);
    this.state = { ...this.state, error: this.state.error ? `${this.state.error}; ${label}: ${message}` : `${label}: ${message}` };
    return null;
  }

  private swallowError(label: string, error: any): null {
    this.logger.info(`${label} unavailable (contact may not exist in Brevo)`, error);
    return null;
  }

  private errorMessage(error: any): string {
    return error?.error?.message || error?.message || "Brevo request failed";
  }

  private dayKey(iso: string): string {
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return iso || "unknown";
    return this.dateUtils.asDateTime(parsed).startOf("day").toISODate() || iso;
  }

  private dayLabel(iso: string): string {
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return iso || "Unknown date";
    const eventDayStart = this.dateUtils.asDateTime(parsed).startOf("day");
    const todayStart = this.dateUtils.dateTimeNow().startOf("day");
    const diffDays = Math.round(todayStart.diff(eventDayStart, "days").days);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return this.dateUtils.displayDate(parsed);
  }

  private resetState(overrides?: Partial<BrevoContactViewState>): void {
    this.state = {
      loading: false,
      loadingMore: false,
      canLoadMore: false,
      eventsDays: 90,
      eventsLimit: 50,
      events: [],
      contactDetails: null,
      campaignStats: null,
      error: null,
      ...overrides
    };
    this.previewedEventKey = null;
    this.previewState = { loading: false, error: null, content: null };
    this.safePreviewBody = null;
  }
}

