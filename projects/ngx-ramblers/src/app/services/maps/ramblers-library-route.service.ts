import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { isArray } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersLibraryRoute, RouteFollowSummary } from "../../models/route-follow.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { RouteFollowPayloadService } from "./route-follow-payload.service";

const RECENT_KEY = "ramblers-library-routes";

@Injectable({
  providedIn: "root"
})
export class RamblersLibraryRouteService {
  private http = inject(HttpClient);
  private payloadService = inject(RouteFollowPayloadService);
  private logger: Logger = inject(LoggerFactory).createLogger("RamblersLibraryRouteService", NgxLoggerLevel.ERROR);

  async lookup(urlOrSlug: string): Promise<RamblersLibraryRoute> {
    const apiResponse = await firstValueFrom(
      this.http.get<{response: RamblersLibraryRoute; message?: string}>("/api/ramblers/library-route", {
        params: {url: urlOrSlug}
      })
    );
    if (!apiResponse?.response) {
      throw new Error(apiResponse?.message || "That Ramblers route could not be loaded");
    } else {
      this.remember(apiResponse.response);
      return apiResponse.response;
    }
  }

  recentSummaries(): RouteFollowSummary[] {
    return this.recentRoutes().map(route => this.payloadService.summaryFromLibraryRoute(route));
  }

  private remember(route: RamblersLibraryRoute): void {
    const others = this.recentRoutes().filter(item => item.slug !== route.slug);
    this.writeRecent([route, ...others].slice(0, 8));
  }

  private recentRoutes(): RamblersLibraryRoute[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.error("recentRoutes failed", error);
      return [];
    }
  }

  private writeRecent(routes: RamblersLibraryRoute[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(routes));
    } catch (error) {
      this.logger.error("writeRecent failed", error);
    }
  }
}
