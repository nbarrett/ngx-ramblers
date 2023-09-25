import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageService } from "../services/page.service";
import { SystemConfigService } from "../services/system/system-config.service";

@Injectable()
export class AreaExistsGuard implements CanActivate {
  private logger: Logger;
  private configLoaded = false;

  constructor(private systemConfigService: SystemConfigService,
              private pageService: PageService,
              private router: Router,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("AreaExistsGuard", NgxLoggerLevel.OFF);
    this.applyConfig();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Observable<boolean> | Promise<boolean> {
    const areaExists = this.pageService.areaExistsFor(state.url);
    const allowed: boolean = !this.configLoaded || areaExists;
    this.logger.info("route:", route, "root.url", route.root.url, "state.url:", state.url, "configLoaded:", this.configLoaded, "areaExists:", areaExists, "allowed:", allowed);
    if (!allowed) {
      this.router.navigate(["/"]);
    }
    return allowed;
  }

  private applyConfig() {
    this.systemConfigService.events().subscribe(item => this.configLoaded = true);
  }
}
