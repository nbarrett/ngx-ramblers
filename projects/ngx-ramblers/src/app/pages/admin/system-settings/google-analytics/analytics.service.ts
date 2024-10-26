import { inject, Injectable } from "@angular/core";
import { GoogleAnalyticsService } from "ngx-google-analytics";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({
  providedIn: "root"
})
export class AnalyticsService {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AnalyticsService", NgxLoggerLevel.ERROR );
  private gaService: GoogleAnalyticsService = inject(GoogleAnalyticsService);

  trackPageView(pagePath: string) {
    this.logger.info("trackPageView:", pagePath);
    this.gaService.pageView(pagePath);
  }

  trackEvent(action: string, category: string, label?: string, value?: number) {
    this.gaService.event(action, category, label, value);
  }
}
