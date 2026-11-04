import {DOCUMENT} from "@angular/common";
import {inject, Injectable} from "@angular/core";

@Injectable({providedIn: "root"})
export class DocumentPrintService {
  private document = inject(DOCUMENT);

  async print(element: HTMLElement, title: string): Promise<void> {
    const frame = this.document.createElement("iframe");
    frame.title = "Document print preview";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;bottom:0;left:0;width:210mm;height:0;border:0;";
    const loaded = new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error("Could not open the document print preview"));
    });
    this.document.body.appendChild(frame);
    try {
      await loaded;
      const target = frame.contentDocument;
      const printWindow = frame.contentWindow;
      if (target && printWindow) {
        target.title = title;
        const base = target.createElement("base");
        base.href = this.document.baseURI;
        target.head.appendChild(base);
        const styles = [...this.document.querySelectorAll("style, link[rel=stylesheet]")];
        await Promise.all(styles.map(source => {
          const clone = source.cloneNode(true) as HTMLLinkElement;
          const ready = source.tagName === "LINK"
            ? new Promise<void>((resolve, reject) => {
              clone.onload = () => resolve();
              clone.onerror = () => reject(new Error("Could not load the document print styles"));
            })
            : Promise.resolve();
          target.head.appendChild(clone);
          return ready;
        }));
        target.body.appendChild(element.cloneNode(true));
        await target.fonts.ready;
        await Promise.all([...target.images].map(image => image.decode()));
        printWindow.focus();
        const printed = new Promise<void>(resolve => printWindow.addEventListener("afterprint", () => resolve(), {once: true}));
        printWindow.print();
        await printed;
      } else {
        throw new Error("Document printing is not available in this browser");
      }
    } finally {
      frame.remove();
    }
  }
}
