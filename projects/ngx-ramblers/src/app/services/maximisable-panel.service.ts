import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";

@Injectable({providedIn: "root"})
export class MaximisablePanelService {
  private document = inject(DOCUMENT);
  private maximisedPanels = new Set<object>();
  private documentOverflow: string | null = null;
  private bodyOverflow: string | null = null;

  updateDocumentScrolling(panel: object, maximised: boolean): void {
    if (maximised) {
      if (this.maximisedPanels.size === 0) {
        this.documentOverflow = this.document.documentElement.style.overflow;
        this.bodyOverflow = this.document.body.style.overflow;
        this.document.documentElement.style.overflow = "hidden";
        this.document.body.style.overflow = "hidden";
      }
      this.maximisedPanels.add(panel);
    } else {
      this.maximisedPanels.delete(panel);
      if (this.maximisedPanels.size === 0 && this.documentOverflow !== null && this.bodyOverflow !== null) {
        this.document.documentElement.style.overflow = this.documentOverflow;
        this.document.body.style.overflow = this.bodyOverflow;
        this.documentOverflow = null;
        this.bodyOverflow = null;
      }
    }
  }
}
