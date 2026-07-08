import { CommonModule } from "@angular/common";
import { Component, inject, Input } from "@angular/core";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { HttpClient } from "@angular/common/http";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faDownload, faPaperclip, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { parse } from "csv-parse/browser/esm/sync";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { AttachmentPreview, AttachmentPreviewKind } from "../../../models/inbox.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-attachment-preview",
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, CdkDrag, CdkDragHandle],
  styleUrls: ["./attachment-preview.sass"],
  template: `
    @if (previewedAttachment) {
      <div class="modal fade show d-block attachment-preview-modal" tabindex="-1" (mousedown)="onBackdropMouseDown($event)">
        <div class="modal-dialog modal-lg" cdkDrag cdkDragBoundary=".attachment-preview-modal">
          <div class="modal-content">
            <div class="modal-header" cdkDragHandle>
              <h5 class="modal-title">
                <fa-icon [icon]="faPaperclip" class="me-2"/>{{ previewedAttachment.filename }}
              </h5>
              <button type="button" class="btn-close btn-close-white" aria-label="Close" (click)="close()"></button>
            </div>
            <div class="modal-body">
              @switch (previewKind) {
                @case ("image") {
                  <img [src]="previewedAttachment.url" [alt]="previewedAttachment.filename" class="img-fluid">
                }
                @case ("pdf") {
                  <iframe [src]="previewSafeUrl" class="attachment-preview-frame" [title]="previewedAttachment.filename"></iframe>
                }
                @case ("csv") {
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
                @case ("text") {
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
            </div>
            <div class="modal-footer">
              <a class="btn btn-primary" [href]="previewedAttachment.url" [attr.download]="previewedAttachment.filename">
                <fa-icon [icon]="faDownload" class="me-2"/>Download
              </a>
              <button type="button" class="btn btn-secondary" (click)="close()">Close</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }
  `
})
export class AttachmentPreviewComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("AttachmentPreviewComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private sanitiser = inject(DomSanitizer);

  @Input() maximumPreviewRows = 200;
  @Input() maximumPreviewCharacters = 100000;

  protected previewedAttachment: AttachmentPreview | null = null;
  protected previewKind: AttachmentPreviewKind = AttachmentPreviewKind.NONE;
  protected previewText: string | null = null;
  protected previewCsvRows: string[][] | null = null;
  protected previewCsvHeadings: string[] = [];
  protected previewCsvTotalRows = 0;
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
    this.previewSafeUrl = this.previewKind === AttachmentPreviewKind.PDF ? this.sanitiser.bypassSecurityTrustResourceUrl(attachment.url) : null;
    if (this.previewKind === AttachmentPreviewKind.CSV) {
      await this.loadCsvPreview(attachment);
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
    this.previewSafeUrl = null;
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  private previewKindFor(attachment: AttachmentPreview): AttachmentPreviewKind {
    const contentType = (attachment.contentType || "").toLowerCase();
    const filename = (attachment.filename || "").toLowerCase();
    if (contentType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].some(extension => filename.endsWith(extension))) {
      return AttachmentPreviewKind.IMAGE;
    }
    if (contentType === "application/pdf" || filename.endsWith(".pdf")) {
      return AttachmentPreviewKind.PDF;
    }
    if (contentType.includes("csv") || filename.endsWith(".csv")) {
      return AttachmentPreviewKind.CSV;
    }
    const textExtensions = [".txt", ".json", ".md", ".log", ".ics"];
    if (contentType.startsWith("text/") || contentType.includes("json") || textExtensions.some(extension => filename.endsWith(extension))) {
      return AttachmentPreviewKind.TEXT;
    }
    return AttachmentPreviewKind.NONE;
  }

  private async loadCsvPreview(attachment: AttachmentPreview): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(attachment.url, {responseType: "text"}));
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

  private async loadTextPreview(attachment: AttachmentPreview): Promise<void> {
    try {
      const text = await firstValueFrom(this.http.get(attachment.url, {responseType: "text"}));
      this.previewText = text.length > this.maximumPreviewCharacters ? `${text.substring(0, this.maximumPreviewCharacters)}\n… (truncated — download for the full file)` : text;
    } catch (error) {
      this.logger.error("attachment preview failed for", attachment, error);
      this.previewText = "Preview failed to load — use Download instead.";
    }
  }
}
