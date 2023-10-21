import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { WalkDisplayService } from "../pages/walks/walk-display.service";
import { LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../services/system/system-config.service";

export function WalksPopulationLocalGuard(): boolean {
  let configLoaded = false;
  const router: Router = inject(Router);
  const systemConfigService: SystemConfigService = inject(SystemConfigService);
  const loggerFactory: LoggerFactory = inject(LoggerFactory);
  const logger = loggerFactory.createLogger("WalksPopulationLocalGuard", NgxLoggerLevel.OFF);
  systemConfigService.events().subscribe(item => {
    configLoaded = true;
    logger.info("configLoaded");
  });
  const displayService: WalkDisplayService = inject(WalkDisplayService);

  const allowed = !configLoaded || displayService.walkPopulationLocal();
  logger.info("walkPopulationLocal allowed:", allowed);
  if (!allowed) {
    router.navigate(["/walks"]);
  }
  return allowed;
}
