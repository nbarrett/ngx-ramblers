import { Component, inject, Input, OnChanges, SimpleChanges } from "@angular/core";
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
      <div class="d-flex align-items-center mb-2">
        @if (contactId) {
          <button type="button" class="btn btn-sm btn-outline-secondary me-2"
                  [disabled]="state.loading"
                  (click)="refresh()">
            <fa-icon [icon]="faArrowsRotate" class="me-1"></fa-icon>
            Refresh
          </button>
          <a class="btn btn-sm btn-outline-secondary"
             target="_blank"
             rel="noopener"
             [href]="brevoLink()">
            <fa-icon [icon]="faExternalLinkAlt" class="me-1"></fa-icon>
            Open in Brevo
          </a>
        } @else {
          <span class="text-muted small">Contact not yet created in Brevo</span>
        }
      </div>

      @if (contactId) {
        @if (state.error) {
          <div class="alert alert-danger small mb-3">{{ state.error }}</div>
        }
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="border rounded p-3 h-100">
              <div class="text-muted text-uppercase small mb-2">Channels</div>
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
          <div class="col-md-6">
            <div class="border rounded p-3 h-100">
              <div class="text-muted text-uppercase small mb-2">Email campaigns</div>
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
        </div>

        <div class="border rounded p-3 mb-3">
          <div class="d-flex align-items-center mb-2">
            <div class="text-muted text-uppercase small flex-grow-1">Recent history</div>
            <span class="small text-muted">{{ state.events.length }} event{{ state.events.length === 1 ? "" : "s" }}</span>
          </div>
          @if (state.loading && state.events.length === 0) {
            <div class="text-muted small">Loading...</div>
          } @else if (state.events.length === 0) {
            <div class="text-muted small">No transactional events in the last {{ state.eventsDays }} days.</div>
          } @else {
            @for (group of eventGroups(); track group.label) {
              <div class="mb-3">
                <div class="text-muted small mb-1">{{ group.label }}</div>
                @for (event of group.events; track $index) {
                  <div class="border-start ps-3 py-2 mb-1" style="border-left-width: 2px !important;">
                    <div class="d-flex align-items-center flex-wrap gap-2">
                      <span class="badge" [class]="badgeClassFor(event.event)">
                        <fa-icon [icon]="iconFor(event.event)" class="me-1"></fa-icon>
                        {{ labelFor(event.event) }}
                      </span>
                      <span class="text-muted small">{{ formatIso(event.date) }}</span>
                      @if (event.from) {
                        <span class="text-muted small">from {{ event.from }}</span>
                      }
                    </div>
                    @if (event.subject) {
                      <div class="fw-semibold">{{ event.subject }}</div>
                    }
                    @if (event.reason) {
                      <div class="small text-danger">{{ event.reason }}</div>
                    }
                    @if (event.link) {
                      <div class="small text-truncate">
                        <a [href]="event.link" target="_blank" rel="noopener">{{ event.link }}</a>
                      </div>
                    }
                    @if (event.messageId) {
                      <button type="button" class="btn btn-sm btn-link p-0 mt-1"
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
  protected previewedEventKey: string | null = null;
  protected previewState: { loading: boolean; error: string | null; content: BrevoTransactionalEmailContent | null } = { loading: false, error: null, content: null };
  protected safePreviewBody: SafeHtml | null = null;

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
  private readonly EVENT_BADGE_CLASSES: Record<string, string> = {
    [BrevoEventType.REQUESTS]: "bg-secondary",
    [BrevoEventType.DELIVERED]: "bg-success",
    [BrevoEventType.OPENED]: "bg-info text-dark",
    [BrevoEventType.CLICKS]: "bg-primary text-dark",
    [BrevoEventType.HARD_BOUNCES]: "bg-danger",
    [BrevoEventType.SOFT_BOUNCES]: "bg-warning text-dark",
    [BrevoEventType.BOUNCES]: "bg-danger",
    [BrevoEventType.SPAM]: "bg-danger",
    [BrevoEventType.BLOCKED]: "bg-danger",
    [BrevoEventType.ERROR]: "bg-danger",
    [BrevoEventType.UNSUBSCRIBED]: "bg-dark"
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["contactId"] || changes["contactEmail"]) {
      this.resetState();
      if (this.contactId) {
        void this.loadAll();
      }
    }
  }

  protected refresh(): void {
    if (this.contactId) {
      this.resetState();
      void this.loadAll();
    }
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

  protected badgeClassFor(eventType: string): string {
    return this.EVENT_BADGE_CLASSES[eventType] || "bg-secondary";
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

  protected eventKey(event: BrevoEmailEvent): string {
    return `${event.messageId}|${event.event}|${event.date}`;
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
    try {
      const [details, stats, report] = await Promise.all([
        this.brevoContactService.getContactInfo(this.contactEmail).catch(error => this.captureError("contact info", error)),
        this.brevoContactService.getContactCampaignStats(this.contactEmail).catch(error => this.captureError("campaign stats", error)),
        this.brevoContactService.getEmailEventReport(this.contactEmail, { days: this.state.eventsDays, limit: this.state.eventsLimit, offset: 0 }).catch(error => this.captureError("event report", error))
      ]);
      const events = report?.events || [];
      this.state = {
        ...this.state,
        loading: false,
        contactDetails: details || null,
        campaignStats: stats || null,
        events,
        canLoadMore: events.length === this.state.eventsLimit
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

