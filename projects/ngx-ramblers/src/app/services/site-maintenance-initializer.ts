import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { SiteMaintenanceService } from "./site-maintenance.service";
import { HealthStatus } from "../models/health.model";
import { MemberLoginService } from "./member/member-login.service";
import { LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { ADMIN_MAINTENANCE_PATH, ADMIN_SET_PASSWORD_PATH } from "../models/system.model";

export function checkMigrationStatus() {
  const siteMaintenanceService = inject(SiteMaintenanceService);
  const router = inject(Router);
  const memberLoginService = inject(MemberLoginService);
  const logger = inject(LoggerFactory).createLogger("SiteMaintenanceInitializer", NgxLoggerLevel.OFF);

  return (async () => {
    try {
      const currentPath = window.location.pathname;
      if (currentPath.includes(ADMIN_SET_PASSWORD_PATH)) {
        logger.info("Password reset URL detected, skipping migration check");
        return;
      }

      const status = await siteMaintenanceService.getMigrationStatus();
      logger.info("Migration status on startup:", status);

      const isAdmin = memberLoginService.isAdmin();

      if (status.status !== HealthStatus.OK && status.migrations) {
        const { pending, failed } = status.migrations;

        if (failed || pending > 0) {
          if (!isAdmin) {
            logger.warn("Migrations pending/failed, redirecting to maintenance page");
            router.navigate(["/" + ADMIN_MAINTENANCE_PATH]);
          } else {
            logger.info("Admin user detected, allowing access despite migration issues");
          }
        }
      }
    } catch (error) {
      logger.error("Failed to check migration status on startup:", error);
    }
  })();
}
