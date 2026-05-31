import { Component, ElementRef, inject, Input, OnDestroy, ViewChild } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { isUndefined } from "es-toolkit/compat";

@Component({
  selector: "app-html-frame",
  standalone: true,
  imports: [],
  template: `
    @if (url) {
      <iframe
        #frame
        title="Message content"
        scrolling="no"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
        (load)="resize()"
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
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  @Input() set html(value: string) {
    this.clearObjectUrl();
    this.objectUrl = URL.createObjectURL(new Blob([this.wrap(value ?? "")], {type: "text/html"}));
    this.url = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
  }

  private wrap(html: string): string {
    const base = `<base href="${window.location.origin}/" target="_blank">`;
    const reset = `<style>html,body{margin:0;padding:0;background:#fff;}img{max-width:100%;height:auto;}table{max-width:100%;}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;}body{overflow-wrap:anywhere;}</style>`;
    return `<!doctype html><html><head><meta charset="utf-8">${base}${reset}</head><body>${html}</body></html>`;
  }

  resize(): void {
    const frame = this.frame?.nativeElement;
    const doc = frame?.contentDocument;
    const applyHeight = () => {
      const height = Math.max(
        doc?.body?.scrollHeight || 0,
        doc?.body?.offsetHeight || 0,
        doc?.documentElement?.scrollHeight || 0
      );
      if (frame && height > 0) {
        frame.style.height = `${height}px`;
      }
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
