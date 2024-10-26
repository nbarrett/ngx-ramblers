import { firstValueFrom } from "rxjs";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../../services/logger-factory.service";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function initializeGtag(systemConfigService: SystemConfigService, loggerFactory: LoggerFactory) {
  const logger = loggerFactory.createLogger("initializeGtag", NgxLoggerLevel.ERROR);
  return async () => {
    try {
      const config: SystemConfig = await firstValueFrom(systemConfigService.events());
      const trackingId = config.googleAnalytics?.trackingId;
      logger.info("trackingId:", trackingId);
      if (trackingId) {
        const gtagScript = document.createElement("script");
        gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
        gtagScript.async = true;
        gtagScript.onload = () => {
          window.dataLayer = window.dataLayer || [];
          window.gtag = (...args: any[]) => window.dataLayer.push(args);
          window.gtag("js", new Date());
          window.gtag("config", trackingId);
          logger.info("Google Analytics initialized successfully with trackingId:", trackingId);
        };

        gtagScript.onerror = (error) => {
          logger.error("Failed to load Google Tag Manager script:", error);
        };

        document.head.appendChild(gtagScript);
      } else {
        logger.error("Google Analytics tracking ID is missing from configuration.");
      }
    } catch (error) {
      logger.error("Failed to initialize Google Tag Manager:", error);
    }
  };
}
