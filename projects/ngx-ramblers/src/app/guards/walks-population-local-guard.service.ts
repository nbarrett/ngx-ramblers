import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { WalkDisplayService } from "../pages/walks/walk-display.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable()
export class WalksPopulationLocalGuard implements CanActivate {
  private logger: Logger;
  constructor(private displayService: WalkDisplayService, private router: Router,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalksPopulationLocalGuard", NgxLoggerLevel.OFF);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const allowed = this.displayService.walkPopulationLocal();
    this.logger.info("walkPopulationLocal allowed:", allowed);
    if (!allowed) {
      this.router.navigate(["/walks"]);
    }
    return allowed;
  }
}
