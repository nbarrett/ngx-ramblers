import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from "@angular/router";
import { LoggerFactory } from "../services/logger-factory.service";
import { inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";

export class CustomReuseStrategy implements RouteReuseStrategy {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("CustomReuseStrategy", NgxLoggerLevel.OFF);

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return false;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    const shouldReUse = future.routeConfig === current.routeConfig;
    this.logger.info("future", future.routeConfig, "current", current.routeConfig, "shouldReuseRoute:", shouldReUse);
    return shouldReUse;
  }
}
