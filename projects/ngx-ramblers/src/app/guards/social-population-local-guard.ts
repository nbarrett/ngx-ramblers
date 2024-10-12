import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../services/system/system-config.service";
import { SocialDisplayService } from "../pages/social/social-display.service";

export function SocialPopulationLocalGuard(): boolean {
  let configLoaded = false;
  const router: Router = inject(Router);
  const systemConfigService: SystemConfigService = inject(SystemConfigService);
  const loggerFactory: LoggerFactory = inject(LoggerFactory);
  const logger = loggerFactory.createLogger("SocialPopulationLocalGuard", NgxLoggerLevel.OFF);
  systemConfigService.events().subscribe(item => {
    configLoaded = true;
    logger.info("configLoaded");
  });
  const displayService: SocialDisplayService = inject(SocialDisplayService);

  const allowed = !configLoaded || displayService.socialPopulationLocal();
  logger.info("walkPopulationLocal allowed:", allowed);
  if (!allowed) {
    router.navigate(["/walks"]);
  }
  return allowed;
}
