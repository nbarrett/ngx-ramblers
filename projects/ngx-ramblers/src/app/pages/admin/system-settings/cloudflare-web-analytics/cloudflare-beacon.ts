import { firstValueFrom } from "rxjs";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { environment } from "../../../../../environments/environment";

export function initializeCloudflareBeacon(systemConfigService: SystemConfigService, loggerFactory: LoggerFactory) {
  const logger = loggerFactory.createLogger("initializeCloudflareBeacon", NgxLoggerLevel.INFO);
  return async () => {
    try {
      if (!environment.production) {
        logger.info("Cloudflare Web Analytics skipped in non-production builds");
      } else {
        const config: SystemConfig = await firstValueFrom(systemConfigService.events());
        const settings = config.cloudflareWebAnalytics;
        if (!settings?.enabled) {
          logger.info("Cloudflare Web Analytics disabled - skipping beacon injection");
        } else if (!settings.siteToken) {
          logger.warn("Cloudflare Web Analytics enabled but siteToken is missing - skipping beacon injection");
        } else {
          const beacon = document.createElement("script");
          beacon.defer = true;
          beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
          beacon.setAttribute("data-cf-beacon", JSON.stringify({token: settings.siteToken, spa: true}));
          beacon.onload = () => logger.info("Cloudflare Web Analytics beacon loaded for siteToken:", settings.siteToken);
          beacon.onerror = () => logger.info("Cloudflare Web Analytics beacon did not load (commonly blocked by a browser privacy extension)");
          document.head.appendChild(beacon);
        }
      }
    } catch (error) {
      logger.info("Failed to initialise Cloudflare Web Analytics beacon:", error);
    }
  };
}
