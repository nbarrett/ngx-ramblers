import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { isUndefined } from "es-toolkit/compat";
import { DisplayedWalk } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { AlertInstance } from "../../services/notifier.service";
import { WalkDisplayService } from "./walk-display.service";

@Injectable({providedIn: "root"})
export class WalkShareService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkShareService", NgxLoggerLevel.ERROR);
  private display = inject(WalkDisplayService);

  async shareWalk(displayedWalk: DisplayedWalk, notify?: AlertInstance): Promise<void> {
    const url = this.absoluteWalkUrl(displayedWalk);
    if (!url) {
      return;
    }
    const title = displayedWalk?.walk?.groupEvent?.title
      || `This ${this.display.eventTypeTitle(displayedWalk?.walk)}`;
    const shareData: ShareData = {title, url};
    const nav: any = navigator;
    if (typeof nav.share === "function" && (typeof nav.canShare !== "function" || nav.canShare(shareData))) {
      try {
        await nav.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        this.logger.warn("shareWalk:navigator.share failed, falling back to clipboard:", err);
      }
    }
    await this.writeLinkToClipboard(url, notify);
  }

  async copyLink(displayedWalk: DisplayedWalk, notify?: AlertInstance): Promise<void> {
    const url = this.absoluteWalkUrl(displayedWalk);
    if (!url) {
      return;
    }
    await this.writeLinkToClipboard(url, notify);
  }

  absoluteWalkUrl(displayedWalk: DisplayedWalk): string {
    const walkLink = displayedWalk?.walkLink;
    if (!walkLink) {
      return "";
    }
    const win = globalThis.window;
    if (isUndefined(win) || !win?.location) {
      return walkLink;
    }
    try {
      return new URL(walkLink, win.location.origin).toString();
    } catch {
      return walkLink;
    }
  }

  private async writeLinkToClipboard(url: string, notify?: AlertInstance): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      notify?.success({title: "Link copied", message: url});
    } catch (err) {
      this.logger.error("writeLinkToClipboard failed:", err);
      notify?.error({title: "Unable to copy link", message: url});
    }
  }
}
