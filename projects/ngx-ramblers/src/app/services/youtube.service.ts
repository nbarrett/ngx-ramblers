import { inject, Injectable, NgZone } from "@angular/core";
import { YouTubeDomain, YouTubeQuality } from "../models/youtube.model";
import { Subject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { isString } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class YouTubeService {
  private logger = inject(LoggerFactory).createLogger("YouTubeService", NgxLoggerLevel.ERROR);
  private ngZone: NgZone = inject(NgZone);
  private initializedIframes: Set<string> = new Set();
  private trackingSubject: Subject<(state: number) => void> = new Subject();
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private stateChangeCallback: ((state: number) => void) | null = null;
  private trackingSubscription: Subscription | null = null;

  extractVideoId(input: string): string | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();

    if (this.isValidVideoId(trimmed)) {
      return trimmed;
    }

    const shortUrlMatch = trimmed.match(/(?:youtu\.be|youtube\.com\/shorts)\/([a-zA-Z0-9_-]{11})/);
    if (shortUrlMatch) {
      return shortUrlMatch[1];
    }

    const standardUrlMatch = trimmed.match(/(?:youtube\.com\/(?:watch|embed|v|live))(?:\/|\?v=)([a-zA-Z0-9_-]{11})/);
    if (standardUrlMatch) {
      return standardUrlMatch[1];
    }

    const embedUrlMatch = trimmed.match(/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedUrlMatch) {
      return embedUrlMatch[1];
    }

    return null;
  }

  isValidVideoId(input: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(input);
  }

  embedUrl(videoId: string, enableApi: boolean = false): string {
    if (!videoId) {
      return null;
    }
    const apiParam = enableApi ? "?enablejsapi=1" : "";
    return `https://${YouTubeDomain.EMBED}/embed/${videoId}${apiParam}`;
  }

  thumbnailUrl(videoId: string, quality: YouTubeQuality = YouTubeQuality.MAX): string {
    if (!videoId) {
      return null;
    }
    return `https://${YouTubeDomain.THUMBNAIL}/vi/${videoId}/${quality}.jpg`;
  }

  setupIframeTracking(onStateChange: (state: number) => void): void {
    this.stateChangeCallback = onStateChange;
    if (!this.messageListener) {
      this.setupMessageListener();
    }
    if (!this.trackingSubscription) {
      this.trackingSubscription = this.trackingSubject.pipe(debounceTime(500)).subscribe(() => {
        this.initializeIframes();
      });
    }
  }

  triggerIframeTracking(): void {
    this.trackingSubject.next(this.stateChangeCallback);
  }

  cleanupIframeTracking(): void {
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
      this.messageListener = null;
    }
    if (this.trackingSubscription) {
      this.trackingSubscription.unsubscribe();
      this.trackingSubscription = null;
    }
    this.stateChangeCallback = null;
  }

  private setupMessageListener(): void {
    this.logger.info("Setting up YouTube message listener");
    this.messageListener = (event: MessageEvent) => {
      this.logger.info("Received postMessage event from:", event.origin, "data:", event.data);

      if (event.origin !== `https://${YouTubeDomain.EMBED}` && event.origin !== "https://www.youtube.com") {
        this.logger.info("Ignoring message from non-YouTube origin:", event.origin);
        return;
      }

      let data;
      if (isString(event.data)) {
        try {
          data = JSON.parse(event.data);
          this.logger.info("Parsed JSON data:", data);
        } catch (e) {
          this.logger.info("Failed to parse event data as JSON, ignoring");
          return;
        }
      } else {
        data = event.data;
        this.logger.info("Event data is already an object:", data);
      }

      if (data.event === "infoDelivery" && data.info?.playerState !== undefined) {
        this.logger.info("YouTube player state change via infoDelivery:", data.info.playerState);
        this.stateChangeCallback?.(data.info.playerState);
      } else if (data.event === "onStateChange" && data.info !== undefined) {
        this.logger.info("YouTube player state change via onStateChange:", data.info);
        this.stateChangeCallback?.(data.info);
      } else {
        this.logger.info("Event does not match expected YouTube state change format");
      }
    };

    window.addEventListener("message", this.messageListener);
    this.logger.info("YouTube message listener registered");
  }

  private initializeIframes(): void {
    this.logger.info("Searching for YouTube iframes in document");
    const allIframes = document.querySelectorAll(`iframe[src*="youtube"]`);
    this.logger.info("Found", allIframes.length, "YouTube iframes total in document");

    allIframes.forEach((iframe: HTMLIFrameElement, index: number) => {
      const iframeSrc = iframe.src;
      if (this.initializedIframes.has(iframeSrc)) {
        this.logger.info(`Iframe ${index + 1} already initialized, skipping:`, iframeSrc);
        return;
      }

      this.logger.info(`Processing iframe ${index + 1}:`, iframeSrc);
      this.logger.info(`  Parent element:`, iframe.parentElement?.tagName, iframe.parentElement?.className);

      if (iframe.contentWindow) {
        this.sendTrackingMessages(iframe, index, iframeSrc);
      } else {
        this.logger.info(`Iframe ${index + 1} not ready, waiting for load event`);
        iframe.addEventListener("load", () => {
          this.ngZone.run(() => {
            if (!this.initializedIframes.has(iframeSrc) && iframe.contentWindow) {
              this.sendTrackingMessages(iframe, index, iframeSrc);
            }
          });
        }, { once: true });
      }
    });
  }

  private sendTrackingMessages(iframe: HTMLIFrameElement, index: number, iframeSrc: string): void {
    const message = JSON.stringify({ event: "listening" });
    this.logger.info(`Sending 'listening' event to iframe ${index + 1}:`, message);
    iframe.contentWindow.postMessage(message, "*");

    const infoMessage = JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] });
    this.logger.info(`Sending addEventListener command to iframe ${index + 1}:`, infoMessage);
    iframe.contentWindow.postMessage(infoMessage, "*");

    this.initializedIframes.add(iframeSrc);
    this.logger.info(`Iframe ${index + 1} initialized and tracked:`, iframeSrc);
  }
}
