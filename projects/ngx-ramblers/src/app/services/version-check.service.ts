import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { BuildVersion, VERSION_CHECK_INTERVAL_MS } from "../models/build-version.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { RouteFollowService } from "./maps/route-follow.service";

const NON_TEXT_INPUT_TYPES = ["checkbox", "radio", "range", "color", "file", "submit", "button", "reset", "image"];

@Injectable({
  providedIn: "root"
})
export class VersionCheckService {

  private logger: Logger = inject(LoggerFactory).createLogger("VersionCheckService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private router = inject(Router);
  private routeFollow = inject(RouteFollowService);
  private BASE_URL = "/api/version";
  private runningBuildNumber: string;
  private newVersionAvailable = false;
  private userHasEditedSinceNavigation = false;
  private reloadDeferredSubject = new BehaviorSubject<boolean>(false);
  readonly reloadDeferred$: Observable<boolean> = this.reloadDeferredSubject.asObservable();

  initialise(): void {
    this.captureRunningVersion();
    setInterval(() => this.checkForNewVersion(), VERSION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.checkForNewVersion();
      }
    });
    document.addEventListener("input", event => {
      if (this.isTextEntry(event.target)) {
        this.userHasEditedSinceNavigation = true;
      }
    }, true);
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

  reloadNow(): void {
    this.reloadPage();
  }

  private isTextEntry(target: EventTarget | null): boolean {
    if (target instanceof HTMLTextAreaElement) {
      return true;
    } else if (target instanceof HTMLInputElement) {
      return !NON_TEXT_INPUT_TYPES.includes(target.type);
    } else if (target instanceof HTMLElement) {
      return target.isContentEditable;
    } else {
      return false;
    }
  }

  private reloadIfReady(): void {
    if (this.newVersionAvailable && this.safeToReload()) {
      this.logger.info("reloading to pick up new version");
      this.reloadDeferredSubject.next(false);
      this.reloadPage();
    } else if (this.newVersionAvailable) {
      this.logger.info("new version available but reload deferred while the page is busy");
      this.reloadDeferredSubject.next(true);
    }
  }

  private safeToReload(): boolean {
    return !document.body.classList.contains("modal-open")
      && !this.userHasEditedSinceNavigation
      && !this.routeFollow.isBusy();
  }

  protected reloadPage(): void {
    location.reload();
  }

}
