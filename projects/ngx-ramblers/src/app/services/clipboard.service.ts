import { inject, Injectable } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class ClipboardService {

  private logger: Logger = inject(LoggerFactory).createLogger("ClipboardService", NgxLoggerLevel.ERROR);
  private lastCopiedText: string;

  private clipboardData(e: ClipboardEvent): DataTransfer {
    return e?.clipboardData || window["clipboardData"];
  }

  public copyToClipboardWithTooltip(text: string, preClickTooltip: TooltipDirective, postClickTooltip: TooltipDirective): void {
    this.copyToClipboard(text);
    preClickTooltip.hide();
    postClickTooltip.show();
  }

  public async copyToClipboard(item: string): Promise<void> {
    if (item) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(item);
          this.lastCopiedText = item;
          this.logger.info("copied using navigator.clipboard:", this.lastCopiedText);
        } else {
          const listener = (e: ClipboardEvent) => {
            const clipboard: DataTransfer = this.clipboardData(e);
            clipboard.setData("text", item);
            this.lastCopiedText = item;
            e.preventDefault();
            this.logger.info("copied using execCommand:", this.lastCopiedText);
          };

          document.addEventListener("copy", listener, false);
          document.execCommand("copy");
          document.removeEventListener("copy", listener, false);
        }
      } catch (err) {
        this.logger.error("failed to copy to clipboard:", err);
      }
    }
  }

  public clipboardText(): string {
    return this.lastCopiedText;
  }
}
