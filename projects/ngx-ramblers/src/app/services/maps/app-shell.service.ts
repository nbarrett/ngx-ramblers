import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { AppAppearance, appAppearanceFromStored, AppInstallPlatform, AppPath, nextAppAppearance } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: string}>;
}

@Injectable({
  providedIn: "root"
})
export class AppShellService {
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private logger: Logger = inject(LoggerFactory).createLogger("AppShellService", NgxLoggerLevel.ERROR);
  private activeSubject = new BehaviorSubject<boolean>(this.isAppUrl(this.router.url));
  readonly active$ = this.activeSubject.asObservable();
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private installAvailableSubject = new BehaviorSubject<boolean>(false);
  readonly installAvailable$ = this.installAvailableSubject.asObservable();
  private appearanceSubject = new BehaviorSubject<AppAppearance>(this.storedAppearance());
  readonly appearance$ = this.appearanceSubject.asObservable();
  private followWorkerRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.applyAppearance(this.appearanceSubject.value);
    this.apply(this.activeSubject.value);
    this.router.events.pipe(filter(event => event instanceof NavigationStart || event instanceof NavigationEnd)).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.apply(this.isAppUrl(event.url));
      } else if (event instanceof NavigationEnd) {
        this.apply(this.isAppUrl(event.urlAfterRedirects));
        if (this.active() && this.followWorkerRegistration) {
          this.cacheLoadedFollowResources(this.followWorkerRegistration);
        }
      }
    });
    this.document.defaultView?.addEventListener("beforeinstallprompt", (event: Event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      this.installAvailableSubject.next(true);
    });
    this.document.defaultView?.addEventListener("appinstalled", () => {
      this.installPrompt = null;
      this.installAvailableSubject.next(false);
    });
    this.registerFollowWorker();
  }

  private registerFollowWorker(): void {
    if (environment.production && this.document.defaultView && "serviceWorker" in navigator) {
      void this.registerAndCacheFollowShell();
    }
  }

  private async registerAndCacheFollowShell(): Promise<void> {
    try {
      await navigator.serviceWorker.register("/inbox-push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      this.followWorkerRegistration = registration;
      const view = this.document.defaultView;
      if (view?.document.readyState === "complete") {
        this.cacheLoadedFollowResources(registration);
      } else {
        view?.addEventListener("load", () => this.cacheLoadedFollowResources(registration), {once: true});
      }
    } catch (error) {
      this.logger.warn("walking app cache could not be prepared", error);
    }
  }

  private cacheLoadedFollowResources(registration: ServiceWorkerRegistration): void {
    const view = this.document.defaultView;
    if (view && this.isAppUrl(view.location.pathname)) {
      const resources = view.performance.getEntriesByType("resource");
      const urls = ["/app", ...resources.map(resource => resource.name)]
        .filter(url => this.followAssetUrl(url));
      registration.active?.postMessage(urls);
    }
  }

  private followAssetUrl(value: string): boolean {
    const view = this.document.defaultView;
    const url = new URL(value, view?.location.origin);
    return url.origin === view?.location.origin
      && (url.pathname === "/app"
        || url.pathname === "/manifest.webmanifest"
        || url.pathname.startsWith("/assets/images/local/pwa-")
        || url.pathname === "/assets/images/local/apple-touch-icon.png"
        || /\.(?:js|css|woff2?)$/.test(url.pathname));
  }

  active(): boolean {
    return this.activeSubject.value;
  }

  isAppUrl(url: string): boolean {
    const path = (url || "").split("?")[0];
    const appRoot = "/" + AppPath.ROOT;
    if (path === appRoot || path === appRoot + "/") {
      return true;
    } else if (path === appRoot + "/" + AppPath.FOLLOW || path.startsWith(appRoot + "/" + AppPath.FOLLOW + "/")) {
      return true;
    } else {
      return false;
    }
  }

  mobilePlatform(): boolean {
    const platform = this.platform();
    return platform === AppInstallPlatform.IOS || platform === AppInstallPlatform.ANDROID;
  }

  platform(): AppInstallPlatform {
    const agent = (this.document.defaultView?.navigator.userAgent || "").toLowerCase();
    if (/iphone|ipad|ipod/.test(agent) || this.isIosDesktopSafari(agent)) {
      return AppInstallPlatform.IOS;
    } else if (/android/.test(agent)) {
      return AppInstallPlatform.ANDROID;
    } else {
      return AppInstallPlatform.OTHER;
    }
  }

  installed(): boolean {
    const view = this.document.defaultView;
    const standalone = view?.matchMedia?.("(display-mode: standalone)")?.matches;
    const iosStandalone = (view?.navigator as Navigator & {standalone?: boolean})?.standalone;
    return !!(standalone || iosStandalone);
  }

  canPromptInstall(): boolean {
    return !!this.installPrompt;
  }

  applyHomeScreenIdentity(shortName: string): void {
    const name = shortName || "Ramblers";
    this.setMetaContent("application-name", name);
    this.setMetaContent("apple-mobile-web-app-title", name);
    void this.replaceManifestNames(name);
  }

  appearance(): AppAppearance {
    return this.appearanceSubject.value;
  }

  setAppearance(appearance: AppAppearance): void {
    try {
      this.document.defaultView?.localStorage.setItem(StoredValue.APP_APPEARANCE, appearance);
    } catch (error) {
      this.logger.warn("could not store app appearance", error);
    }
    this.appearanceSubject.next(appearance);
    this.applyAppearance(appearance);
  }

  cycleAppearance(): void {
    const systemIsDark = !!this.document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    this.setAppearance(nextAppAppearance(this.appearance(), systemIsDark));
  }

  async promptInstall(): Promise<string> {
    if (this.installPrompt) {
      const promptEvent = this.installPrompt;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      this.installPrompt = null;
      this.installAvailableSubject.next(false);
      return choice?.outcome || null;
    } else {
      return null;
    }
  }

  private isIosDesktopSafari(agent: string): boolean {
    return /macintosh/.test(agent) && this.document.defaultView?.navigator.maxTouchPoints > 1;
  }

  private storedAppearance(): AppAppearance {
    try {
      return appAppearanceFromStored(this.document.defaultView?.localStorage.getItem(StoredValue.APP_APPEARANCE) || null);
    } catch (error) {
      this.logger.warn("could not read stored app appearance", error);
      return appAppearanceFromStored(null);
    }
  }

  private setMetaContent(name: string, content: string): void {
    const element = this.document.querySelector(`meta[name="${name}"]`);
    if (element) {
      element.setAttribute("content", content);
    }
  }

  private async replaceManifestNames(name: string): Promise<void> {
    const view = this.document.defaultView;
    if (!view) {
      return;
    } else {
      try {
        const response = await view.fetch("/manifest.webmanifest", {cache: "no-store"});
        const manifest = await response.json();
        const next = {...manifest, name, short_name: name};
        const url = URL.createObjectURL(new Blob([JSON.stringify(next)], {type: "application/manifest+json"}));
        const link = this.document.querySelector("link[rel=\"manifest\"]");
        if (link) {
          link.setAttribute("href", url);
        }
      } catch (error) {
        this.logger.warn("could not update home screen name", error);
      }
    }
  }

  private applyAppearance(appearance: AppAppearance): void {
    const body = this.document.body;
    body.classList.remove("app-appearance-light", "app-appearance-dark", "app-appearance-system");
    if (appearance === AppAppearance.LIGHT) {
      body.classList.add("app-appearance-light");
    } else if (appearance === AppAppearance.DARK) {
      body.classList.add("app-appearance-dark");
    } else {
      body.classList.add("app-appearance-system");
    }
  }

  private apply(active: boolean): void {
    this.activeSubject.next(active);
    if (active) {
      this.document.body.classList.add("app-shell-active");
    } else {
      this.document.body.classList.remove("app-shell-active");
    }
  }
}
