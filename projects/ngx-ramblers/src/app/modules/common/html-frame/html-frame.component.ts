import { booleanAttribute, Component, ElementRef, inject, Input, OnDestroy, ViewChild } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { isUndefined } from "es-toolkit/compat";

@Component({
  selector: "app-html-frame",
  imports: [],
  styles: [`
    :host
      display: block
      min-width: 0
      max-width: 100%
  `],
  template: `
    @if (url) {
      <iframe
        #frame
        title="Message content"
        tabindex="-1"
        scrolling="no"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
        (load)="onFrameLoad()"
        [src]="url"
        style="display:block;width:100%;border:0;background:#fff;"></iframe>
    }
  `
})
export class HtmlFrameComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);

  @ViewChild("frame") frame: ElementRef<HTMLIFrameElement>;

  url: SafeResourceUrl | null = null;
  private objectUrl: string | null = null;
  private lastHtml: string | null = null;
  private lastFitToWidth = false;
  private fitContentToWidth = false;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private lastFrameHeight = 0;
  private focusOwner: Element | null = null;

  @Input() set html(value: string) {
    this.renderHtml(value ?? "");
  }

  @Input({transform: booleanAttribute}) set fitToWidth(value: boolean) {
    this.fitContentToWidth = value;
    if (this.lastHtml !== null) {
      this.renderHtml(this.lastHtml);
    }
  }

  private renderHtml(next: string): void {
    const unchanged = next === this.lastHtml && this.fitContentToWidth === this.lastFitToWidth && !!this.url;
    if (!unchanged) {
      this.lastHtml = next;
      this.lastFitToWidth = this.fitContentToWidth;
      this.focusOwner = document.activeElement;
      this.clearObjectUrl();
      this.objectUrl = URL.createObjectURL(new Blob([this.wrap(next)], {type: "text/html"}));
      this.url = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
    }
  }

  onFrameLoad(): void {
    this.resize();
    const frame = this.frame?.nativeElement;
    const owner = this.focusOwner;
    if (frame && document.activeElement === frame && owner instanceof HTMLElement && owner !== frame) {
      owner.focus();
    }
  }

  private wrap(html: string): string {
    const base = `<base href="${window.location.origin}/" target="_blank">`;
    const reset = `<style>html,body{margin:0;padding:0;background:#fff;overflow:hidden;}img{max-width:100%;height:auto;}table{max-width:100%;}blockquote{border-left:4px solid #9bc8ab;margin:16px 0;padding:12px 20px;background-color:#f7fbf8;color:#343a40;font-style:italic;}blockquote p:first-child{margin-top:0;}blockquote p:last-child{margin-bottom:0;}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;}body{overflow-wrap:anywhere;transform-origin:0 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;}</style>`;
    return `<!doctype html><html><head><meta charset="utf-8">${base}${reset}</head><body>${html}</body></html>`;
  }

  resize(): void {
    const frame = this.frame?.nativeElement;
    const doc = frame?.contentDocument;
    const applyHeight = () => {
      if (!frame || !doc?.body) {
      } else {
        doc.body.style.transform = "";
        const contentWidth = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth, 1);
        const contentHeight = Math.max(doc.body.scrollHeight, doc.body.offsetHeight, doc.documentElement.scrollHeight);
        const frameWidth = frame.clientWidth || contentWidth;
        const scale = this.fitContentToWidth && contentWidth > frameWidth ? frameWidth / contentWidth : 1;
        if (scale < 1) {
          doc.body.style.transform = `scale(${scale})`;
        }
        const nextHeight = Math.ceil(contentHeight * scale);
        if (nextHeight > 0 && nextHeight !== this.lastFrameHeight) {
          this.lastFrameHeight = nextHeight;
          frame.style.height = `${nextHeight}px`;
        }
      }
    };
    this.clearObservers();
    if (doc?.body && !isUndefined(ResizeObserver)) {
      this.resizeObserver = new ResizeObserver(() => applyHeight());
      this.resizeObserver.observe(doc.body);
      this.resizeObserver.observe(frame);
    }
    doc?.querySelectorAll("img").forEach(image => image.addEventListener("load", applyHeight, {once: true}));
    window.setTimeout(applyHeight, 0);
  }

  ngOnDestroy(): void {
    this.clearObservers();
    this.clearObjectUrl();
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
