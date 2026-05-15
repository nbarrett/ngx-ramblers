import { firstValueFrom } from "rxjs";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../../services/logger-factory.service";

export function initializeCloudflareBeacon(systemConfigService: SystemConfigService, loggerFactory: LoggerFactory) {
  const logger = loggerFactory.createLogger("initializeCloudflareBeacon", NgxLoggerLevel.ERROR);
  return async () => {
    try {
      const config: SystemConfig = await firstValueFrom(systemConfigService.events());
      const settings = config.cloudflareWebAnalytics;
      if (!settings?.enabled) {
        logger.info("Cloudflare Web Analytics disabled - skipping beacon injection");
        return;
      }
      if (!settings.siteToken) {
        logger.warn("Cloudflare Web Analytics enabled but siteToken is missing - skipping beacon injection");
        return;
      }
      const beacon = document.createElement("script");
      beacon.defer = true;
      beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
      beacon.setAttribute("data-cf-beacon", JSON.stringify({token: settings.siteToken, spa: true}));
      beacon.onload = () => logger.info("Cloudflare Web Analytics beacon loaded for siteToken:", settings.siteToken);
      beacon.onerror = (error) => logger.error("Failed to load Cloudflare Web Analytics beacon:", error);
      document.head.appendChild(beacon);
    } catch (error) {
      logger.info("Failed to initialise Cloudflare Web Analytics beacon:", error);
    }
  };
}
