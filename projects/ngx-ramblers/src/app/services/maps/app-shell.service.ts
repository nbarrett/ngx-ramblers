import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { AppAppearance, appAppearanceFromStored, AppInstallPlatform, AppPath, nextAppAppearance } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";

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
  private activeSubject = new BehaviorSubject<boolean>(this.isAppUrl(this.router.url));
  readonly active$ = this.activeSubject.asObservable();
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private installAvailableSubject = new BehaviorSubject<boolean>(false);
  readonly installAvailable$ = this.installAvailableSubject.asObservable();
  private appearanceSubject = new BehaviorSubject<AppAppearance>(this.storedAppearance());
  readonly appearance$ = this.appearanceSubject.asObservable();

  constructor() {
    this.applyAppearance(this.appearanceSubject.value);
    this.apply(this.activeSubject.value);
    this.router.events.pipe(filter(event => event instanceof NavigationStart || event instanceof NavigationEnd)).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.apply(this.isAppUrl(event.url));
      } else if (event instanceof NavigationEnd) {
        this.apply(this.isAppUrl(event.urlAfterRedirects));
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
      void navigator.serviceWorker.register("/inbox-push-sw.js");
    }
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

  appearance(): AppAppearance {
    return this.appearanceSubject.value;
  }

  setAppearance(appearance: AppAppearance): void {
    this.document.defaultView?.localStorage.setItem(StoredValue.APP_APPEARANCE, appearance);
    this.appearanceSubject.next(appearance);
    this.applyAppearance(appearance);
  }

  cycleAppearance(): void {
    const systemIsDark = !!this.document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    this.setAppearance(nextAppAppearance(this.appearance(), systemIsDark));
  }

  async promptInstall(): Promise<void> {
    if (this.installPrompt) {
      await this.installPrompt.prompt();
      this.installPrompt = null;
      this.installAvailableSubject.next(false);
    }
  }

  private isIosDesktopSafari(agent: string): boolean {
    return /macintosh/.test(agent) && this.document.defaultView?.navigator.maxTouchPoints > 1;
  }

  private storedAppearance(): AppAppearance {
    return appAppearanceFromStored(this.document.defaultView?.localStorage.getItem(StoredValue.APP_APPEARANCE) || null);
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
