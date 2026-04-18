import { Component, ElementRef, inject, OnDestroy, ViewChild } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { isUndefined } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { TemplateRenderRequest } from "../../../models/mail.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailService } from "../../../services/mail/mail.service";

@Component({
  selector: "app-email-preview",
  standalone: true,
  imports: [],
  template: `
    <div class="print-preview" style="height:auto;overflow:visible;">
      @if (loading) {
        <div class="p-3">Rendering preview...</div>
      } @else if (error) {
        <div class="alert alert-warning m-3">{{ error }}</div>
      } @else if (previewUrl) {
        <iframe
          #previewFrame
          title="Email preview"
          scrolling="yes"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          (load)="resize()"
          [src]="previewUrl"
          style="display:block;width:100%;height:70vh;border:0;background:#f3f3f3;"></iframe>
      }
    </div>
  `
})
export class EmailPreviewComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private mailService = inject(MailService);
  private logger: Logger = inject(LoggerFactory).createLogger("EmailPreviewComponent", NgxLoggerLevel.ERROR);

  @ViewChild("previewFrame") previewFrame: ElementRef<HTMLIFrameElement>;

  loading = false;
  error: string | null = null;
  previewHtml: string | null = null;
  previewUrl: SafeResourceUrl | null = null;

  private objectUrl: string | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  async render(request: TemplateRenderRequest): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const response = await this.mailService.renderTemplate(request);
      this.clearObservers();
      this.previewHtml = response.htmlContent;
      this.previewUrl = this.toPreviewUrl(response.htmlContent);
    } catch (error) {
      this.previewHtml = null;
      this.previewUrl = null;
      this.error = "Preview could not be rendered.";
      this.logger.error("render failed", error);
    } finally {
      this.loading = false;
    }
  }

  clear(): void {
    this.clearObservers();
    this.clearObjectUrl();
    this.previewHtml = null;
    this.previewUrl = null;
    this.error = null;
    this.loading = false;
  }

  showError(message: string): void {
    this.clear();
    this.error = message;
  }

  ngOnDestroy(): void {
    this.clearObservers();
    this.clearObjectUrl();
  }

  resize(): void {
    const doc = this.previewFrame?.nativeElement?.contentDocument;
    const applyHeight = () => {
      if (doc?.documentElement && doc?.body) {
        doc.documentElement.style.overflow = "hidden";
        doc.body.style.overflow = "hidden";
      }
      return Math.max(
        doc?.body?.scrollHeight || 0,
        doc?.body?.offsetHeight || 0,
        doc?.documentElement?.scrollHeight || 0,
        doc?.documentElement?.offsetHeight || 0,
        1600
      );
    };
    this.clearObservers();
    if (doc?.body && !isUndefined(ResizeObserver)) {
      this.resizeObserver = new ResizeObserver(() => applyHeight());
      this.resizeObserver.observe(doc.body);
      this.resizeObserver.observe(doc.documentElement);
    }
    if (doc?.body && !isUndefined(MutationObserver)) {
      this.mutationObserver = new MutationObserver(() => applyHeight());
      this.mutationObserver.observe(doc.body, {childList: true, subtree: true, attributes: true, characterData: true});
    }
    doc?.querySelectorAll("img").forEach(image => image.addEventListener("load", applyHeight, {once: true}));
    window.setTimeout(applyHeight, 0);
  }

  private toPreviewUrl(html: string): SafeResourceUrl {
    this.clearObjectUrl();
    this.objectUrl = URL.createObjectURL(new Blob([html], {type: "text/html"}));
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
  }

  private clearObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private clearObservers(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }
}
