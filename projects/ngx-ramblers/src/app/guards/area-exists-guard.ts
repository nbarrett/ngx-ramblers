import { inject } from "@angular/core";
import { Router, RouterStateSnapshot } from "@angular/router";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageService } from "../services/page.service";
import { SystemConfigService } from "../services/system/system-config.service";

export function AreaExistsGuard(): boolean {
  let configLoaded = false;
  const router: Router = inject(Router);
  const pageService: PageService = inject(PageService);
  const systemConfigService: SystemConfigService = inject(SystemConfigService);
  const loggerFactory: LoggerFactory = inject(LoggerFactory);
  const logger: Logger = loggerFactory.createLogger("AreaExistsGuard", NgxLoggerLevel.OFF);
  const snapshot: RouterStateSnapshot = router.routerState.snapshot;
  systemConfigService.events().subscribe(item => {
    configLoaded = true;
    logger.info("configLoaded", snapshot.url);
  });
  const areaExists = pageService.areaExistsFor(snapshot.url);
  const allowed: boolean = ["", "/"].includes(snapshot.url) || !configLoaded || (configLoaded && areaExists);
  logger.info("state.url:", snapshot.url, "areaExists:", areaExists, "allowed:", allowed);
  if (!allowed) {
    router.navigate(["/"]);
  }
  return allowed;
}

