import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageService } from "../services/page.service";

@Injectable()
export class AreaExistsGuard implements CanActivate {
  private logger: Logger;

  constructor(private pageService: PageService, private router: Router,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("AreaExistsGuard", NgxLoggerLevel.OFF);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const allowed: boolean = this.pageService.areaExistsFor(state.url);
    this.logger.info("route:", route, "root.url", route.root.url, "state.url:", state.url, "allowed:", allowed);
    if (!allowed) {
      this.router.navigate(["/"]);
    }
    return allowed;
  }
}
