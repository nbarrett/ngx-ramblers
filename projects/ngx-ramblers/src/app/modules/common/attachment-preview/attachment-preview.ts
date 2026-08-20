import { CommonModule } from "@angular/common";
import { Component, inject, Input } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { HttpClient } from "@angular/common/http";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarPlus, faDownload, faPaperclip, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { parse } from "csv-parse/browser/esm/sync";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { UIDateFormat } from "../../../models/date-format.model";
import { AttachmentPreview, AttachmentPreviewKind, CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind } from "../../../models/inbox.model";
import { parseIcsEvents } from "../../../functions/ics-calendar";
import { calendarAppLabel, calendarAppsForDevice, calendarHrefFor, deviceKindFromUserAgent } from "../../../functions/calendar-add";
import { isBrowser } from "es-toolkit";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UrlService } from "../../../services/url.service";
import { DraggableModalComponent } from "../draggable-modal/draggable-modal";
import { ThumbnailHeadingFrameComponent } from "../thumbnail-heading-frame/thumbnail-heading-frame";

@Component({
  selector: "app-attachment-preview",
  imports: [CommonModule, FontAwesomeModule, DraggableModalComponent, ThumbnailHeadingFrameComponent],
  styleUrls: ["./attachment-preview.sass"],
  template: `
    <app-draggable-modal [open]="!!previewedAttachment" (closed)="close()">
      <h5 modalTitle>
        <fa-icon [icon]="faPaperclip" class="me-2"/>{{ previewedAttachment?.filename }}
      </h5>
      <div modalBody>
        @if (previewedAttachment) {
          @switch (previewKind) {
            @case (AttachmentPreviewKind.IMAGE) {
              <img [src]="previewedAttachment.url" [alt]="previewedAttachment.filename" class="img-fluid">
            }
            @case (AttachmentPreviewKind.PDF) {
              <iframe [src]="previewSafeUrl" class="draggable-modal-frame attachment-preview-frame"
                      [title]="previewedAttachment.filename"></iframe>
            }
            @case (AttachmentPreviewKind.ICS) {
              @if (previewCalendarEvents === null) {
                <div class="text-muted">Loading preview...</div>
              } @else if (previewCalendarEvents.length === 0) {
                <div class="alert alert-warning d-flex align-items-start">
                  <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
                  <div>
                    <strong>No events in this calendar</strong>
                    <div>The file opened, but it does not contain a meeting or walk to show.</div>
                  </div>
                </div>
              } @else {
                <div class="attachment-preview-ics">
                  @for (event of previewCalendarEvents; track $index) {
                    <app-thumbnail-heading-frame [heading]="event.title || 'Calendar event'" class="mb-3">
                      @if (event.status === 'CANCELLED') {
                        <div class="alert alert-warning d-flex align-items-start mb-2">
                          <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
                          <div><strong>Cancelled</strong></div>
                        </div>
                      }
                      @if (eventWhen(event); as when) {
                        <div class="mb-1"><strong>When</strong> {{ when }}</div>
                      }
                      @if (event.location) {
                        <div class="mb-1"><strong>Where</strong> {{ event.location }}</div>
                      }
                      @if (event.organiser) {
                        <div class="mb-1"><strong>Organiser</strong> {{ event.organiser }}</div>
                      }
                      @if (event.url) {
                        <div class="mb-1"><strong>Link</strong> <a [href]="event.url" target="_blank" rel="noopener">{{ event.url }}</a></div>
                      }
                      @if (event.description) {
                        <p class="mb-0 mt-2 attachment-preview-ics-description">{{ event.description }}</p>
                      }
                      <div class="d-flex flex-wrap gap-2 mt-3">
                        @for (app of calendarApps; track app) {
                          @if (calendarHref(app, event); as href) {
                            <a class="btn" [class.btn-primary]="calendarIsPrimary(app, event)"
                               [class.btn-quiet]="!calendarIsPrimary(app, event)"
                               [href]="href"
                               [attr.target]="calendarOpensInNewTab(app) ? '_blank' : null"
                               [attr.rel]="calendarOpensInNewTab(app) ? 'noopener' : null">
                              <fa-icon [icon]="calendarIcon(app)" class="me-2"/>{{ calendarLabel(app) }}
                            </a>
                          }
                        }
                      </div>
                    </app-thumbnail-heading-frame>
                  }
                </div>
              }
            }
            @case (AttachmentPreviewKind.CSV) {
              @if (previewCsvRows === null) {
                <div class="text-muted">Loading preview...</div>
              } @else {
                @if (previewCsvTotalRows > previewCsvRows.length) {
                  <div class="small text-muted mb-2">Showing the first {{ previewCsvRows.length }} of {{ previewCsvTotalRows }} rows — download for the full file.</div>
                }
                <div class="attachment-preview-table">
                  <table class="table table-sm table-striped">
                    <thead>
                      <tr>
                        @for (heading of previewCsvHeadings; track $index) {
                          <th>{{ heading }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of previewCsvRows; track $index) {
                        <tr>
                          @for (cell of row; track $index) {
                            <td>{{ cell }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
            @case (AttachmentPreviewKind.TEXT) {
              @if (previewText === null) {
                <div class="text-muted">Loading preview...</div>
              } @else {
                <pre class="attachment-preview-text">{{ previewText }}</pre>
              }
            }
            @default {
              <div class="alert alert-warning">
                <fa-icon [icon]="faTriangleExclamation"/>
                <strong class="ms-2">No preview available</strong>
                <span class="ms-1">— this file type can't be shown here. Use Download instead.</span>
              </div>
            }
          }
        }
      </div>
      @if (previewedAttachment) {
        <div modalFooter class="d-flex flex-wrap gap-2 me-auto">
          <a class="btn" [class.btn-primary]="previewKind !== AttachmentPreviewKind.ICS"
             [class.btn-quiet]="previewKind === AttachmentPreviewKind.ICS"
             [href]="previewedAttachment.url"
             [attr.download]="previewedAttachment.filename">
            <fa-icon [icon]="faDownload" class="me-2"/>Download
          </a>
        </div>
      }
    </app-draggable-modal>
  `
})
export class AttachmentPreviewComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("AttachmentPreviewComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private sanitiser = inject(DomSanitizer);
  private urlService = inject(UrlService);
  private dateUtils = inject(DateUtilsService);
  protected readonly AttachmentPreviewKind = AttachmentPreviewKind;
  protected readonly deviceKind: DeviceKind = deviceKindFromUserAgent(
    isBrowser() ? navigator.userAgent : "",
    isBrowser() ? navigator.platform : null
  );
  protected readonly calendarApps: CalendarApp[] = calendarAppsForDevice(this.deviceKind);
  private readonly calendarClientHints: CalendarClientHints = {
    userAgent: isBrowser() ? navigator.userAgent : "",
    origin: isBrowser() ? window.location.origin : null
  };
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly faGoogle = faGoogle;
  protected readonly faMicrosoft = faMicrosoft;

  @Input() maximumPreviewRows = 200;
  @Input() maximumPreviewCharacters = 100000;

  protected previewedAttachment: AttachmentPreview | null = null;
  protected previewKind: AttachmentPreviewKind = AttachmentPreviewKind.NONE;
  protected previewText: string | null = null;
  protected previewCsvRows: string[][] | null = null;
  protected previewCsvHeadings: string[] = [];
  protected previewCsvTotalRows = 0;
  protected previewCalendarEvents: CalendarPreviewEvent[] | null = null;
  protected previewSafeUrl: SafeResourceUrl | null = null;

  protected readonly faPaperclip = faPaperclip;
  protected readonly faDownload = faDownload;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  async open(attachment: AttachmentPreview): Promise<void> {
    this.previewedAttachment = attachment;
    this.previewKind = this.previewKindFor(attachment);
    this.previewText = null;
    this.previewCsvRows = null;
    this.previewCsvHeadings = [];
    this.previewCsvTotalRows = 0;
    this.previewCalendarEvents = null;
    this.previewSafeUrl = this.previewKind === AttachmentPreviewKind.PDF
      ? this.sanitiser.bypassSecurityTrustResourceUrl(this.urlService.sameOriginUrl(attachment.url))
      : null;
    if (this.previewKind === AttachmentPreviewKind.CSV) {
      await this.loadCsvPreview(attachment);
    } else if (this.previewKind === AttachmentPreviewKind.ICS) {
      await this.loadIcsPreview(attachment);
    } else if (this.previewKind === AttachmentPreviewKind.TEXT) {
      await this.loadTextPreview(attachment);
    }
  }

  protected close(): void {
    this.previewedAttachment = null;
    this.previewText = null;
    this.previewCsvRows = null;
    this.previewCsvHeadings = [];
    this.previewCsvTotalRows = 0;
    this.previewCalendarEvents = null;
    this.previewSafeUrl = null;
  }

  private previewKindFor(attachment: AttachmentPreview): AttachmentPreviewKind {
    const contentType = (attachment.contentType || "").toLowerCase();
    const filename = (attachment.filename || "").toLowerCase();
    const url = (attachment.url || "").split("?")[0].toLowerCase();
    if (contentType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].some(extension => filename.endsWith(extension))) {
      return AttachmentPreviewKind.IMAGE;
    } else if (contentType === "application/pdf" || filename.endsWith(".pdf") || url.endsWith(".pdf")) {
      return AttachmentPreviewKind.PDF;
    } else if (contentType === "text/calendar" || contentType.includes("ics") || filename.endsWith(".ics") || url.endsWith(".ics")) {
      return AttachmentPreviewKind.ICS;
    } else if (contentType.includes("csv") || filename.endsWith(".csv")) {
      return AttachmentPreviewKind.CSV;
    } else {
      const textExtensions = [".txt", ".json", ".md", ".log"];
      if (contentType.startsWith("text/") || contentType.includes("json") || textExtensions.some(extension => filename.endsWith(extension))) {
        return AttachmentPreviewKind.TEXT;
      } else {
        return AttachmentPreviewKind.NONE;
      }
    }
  }

  private async loadCsvPreview(attachment: AttachmentPreview): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(this.urlService.sameOriginUrl(attachment.url), {responseType: "text"}));
      const rows = parse(text, {relax_column_count: true, skip_empty_lines: true, bom: true, record_delimiter: ["\r\n", "\n", "\r"]}) as string[][];
      this.previewCsvHeadings = rows[0] ?? [];
      const dataRows = rows.slice(1);
      this.previewCsvTotalRows = dataRows.length;
      this.previewCsvRows = dataRows.slice(0, this.maximumPreviewRows);
    } catch (error) {
      this.logger.error("csv attachment preview failed for", attachment, "falling back to text:", error);
      this.previewKind = AttachmentPreviewKind.TEXT;
      await this.loadTextPreview(attachment);
    }
  }

  private async loadIcsPreview(attachment: AttachmentPreview): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(this.urlService.sameOriginUrl(attachment.url), {responseType: "text"}));
      const events = parseIcsEvents(text);
      if (events.length > 0) {
        this.previewCalendarEvents = events;
      } else {
        this.previewKind = AttachmentPreviewKind.TEXT;
        await this.loadTextPreview(attachment);
      }
    } catch (error) {
      this.logger.error("calendar attachment preview failed for", attachment, error);
      this.previewKind = AttachmentPreviewKind.TEXT;
      await this.loadTextPreview(attachment);
    }
  }

  calendarLabel(app: CalendarApp): string {
    return calendarAppLabel(app);
  }

  calendarIcon(app: CalendarApp) {
    if (app === CalendarApp.GOOGLE) {
      return this.faGoogle;
    } else if (app === CalendarApp.OUTLOOK) {
      return this.faMicrosoft;
    } else {
      return this.faCalendarPlus;
    }
  }

  calendarOpensInNewTab(app: CalendarApp): boolean {
    return app !== CalendarApp.LOCAL;
  }

  calendarIsPrimary(app: CalendarApp, event: CalendarPreviewEvent): boolean {
    return this.calendarApps.find(candidate => !!this.calendarHref(candidate, event)) === app;
  }

  calendarHref(app: CalendarApp, event: CalendarPreviewEvent): string | null {
    const fileUrl = this.previewedAttachment ? this.urlService.sameOriginUrl(this.previewedAttachment.url) : null;
    return calendarHrefFor(app, event, fileUrl, this.calendarClientHints);
  }

  eventWhen(event: CalendarPreviewEvent): string | null {
    if (!event.startsAt) {
      return null;
    } else if (event.allDay) {
      return this.dateUtils.displayDate(event.startsAt);
    } else if (event.endsAt) {
      const startDay = this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.YEAR_MONTH_DAY);
      const endDay = this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.YEAR_MONTH_DAY);
      return startDay === endDay
        ? `${this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)} - ${this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.DISPLAY_TIME)}`
        : `${this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)} - ${this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)}`;
    } else {
      return this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME);
    }
  }

  private async loadTextPreview(attachment: AttachmentPreview): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(this.urlService.sameOriginUrl(attachment.url), {responseType: "text"}));
      this.previewText = text.length > this.maximumPreviewCharacters
        ? `${text.substring(0, this.maximumPreviewCharacters)}\n… (truncated — download for the full file)`
        : text;
    } catch (error) {
      this.logger.error("attachment preview failed for", attachment, error);
      this.previewText = "Preview failed to load — use Download instead.";
    }
  }
}
