import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";
import { BuildVersion, VERSION_CHECK_INTERVAL_MS } from "../models/build-version.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class VersionCheckService {

  private logger: Logger = inject(LoggerFactory).createLogger("VersionCheckService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private router = inject(Router);
  private BASE_URL = "/api/version";
  private runningBuildNumber: string;
  private newVersionAvailable = false;
  private userHasEditedSinceNavigation = false;

  initialise(): void {
    this.captureRunningVersion();
    setInterval(() => this.checkForNewVersion(), VERSION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.checkForNewVersion();
      }
    });
    document.addEventListener("input", () => this.userHasEditedSinceNavigation = true, true);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.userHasEditedSinceNavigation = false;
        this.reloadIfReady();
      });
  }

  private async captureRunningVersion(): Promise<void> {
    const buildNumber = await this.queryBuildNumber();
    if (buildNumber) {
      this.runningBuildNumber = buildNumber;
      this.logger.info("running build number:", this.runningBuildNumber);
    }
  }

  private async checkForNewVersion(): Promise<void> {
    if (this.newVersionAvailable) {
      this.reloadIfReady();
      return;
    }
    if (!this.runningBuildNumber) {
      await this.captureRunningVersion();
      return;
    }
    const buildNumber = await this.queryBuildNumber();
    if (this.isNewerThanRunning(buildNumber)) {
      this.logger.info("new build number:", buildNumber, "replacing:", this.runningBuildNumber);
      this.newVersionAvailable = true;
      this.reloadIfReady();
    }
  }

  private async queryBuildNumber(): Promise<string> {
    try {
      const response: BuildVersion = await firstValueFrom(this.http.get<BuildVersion>(this.BASE_URL));
      return response?.buildNumber;
    } catch (error) {
      this.logger.debug("version check failed:", error);
      return null;
    }
  }

  private isNewerThanRunning(buildNumber: string): boolean {
    if (!buildNumber || buildNumber === this.runningBuildNumber) {
      return false;
    }
    const deployed = Number(buildNumber);
    const running = Number(this.runningBuildNumber);
    if (isFinite(deployed) && isFinite(running)) {
      return deployed > running;
    }
    return true;
  }

  private reloadIfReady(): void {
    if (this.newVersionAvailable && this.safeToReload()) {
      this.logger.info("reloading to pick up new version");
      this.reloadPage();
    }
  }

  private safeToReload(): boolean {
    return !document.body.classList.contains("modal-open") && !this.userHasEditedSinceNavigation;
  }

  protected reloadPage(): void {
    location.reload();
  }

}
