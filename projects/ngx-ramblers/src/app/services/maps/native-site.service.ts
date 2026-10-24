import { inject, Injectable, InjectionToken } from "@angular/core";
import { Capacitor, CapacitorHttp, HttpResponse, registerPlugin } from "@capacitor/core";
import { isObject, isString } from "es-toolkit/compat";
import { HealthResponse, HealthStatus } from "../../models/health.model";
import { NativeSiteNavigationPlugin, NativeWalkingSite } from "../../models/native-route.model";
import { StoredValue } from "../../models/ui-actions";
import { isNativeLocalShell, nativeWalkingSite, openNativeGroupApp, parseHttpsOrigin, saveNativeWalkingSite } from "../../functions/native-walking";

export const NATIVE_HTTP = new InjectionToken<typeof CapacitorHttp>("NativeHttp", {
  providedIn: "root", factory: () => CapacitorHttp
});

export const NATIVE_SITE_NAVIGATION = new InjectionToken<NativeSiteNavigationPlugin>("NativeSiteNavigation", {
  providedIn: "root",
  factory: () => registerPlugin<NativeSiteNavigationPlugin>("NativeSiteNavigation")
});

@Injectable({
  providedIn: "root"
})
export class NativeSiteService {
  private readonly navigation = inject(NATIVE_SITE_NAVIGATION);
  private readonly nativeHttp = inject(NATIVE_HTTP);
  private readonly canonicalOrigins = new Map<string, Promise<string>>();

  private healthBody(data: unknown): Partial<HealthResponse> {
    let body: Partial<HealthResponse> = {};
    if (isString(data) && data) {
      try {
        body = JSON.parse(data) as Partial<HealthResponse>;
      } catch {
        body = {};
      }
    } else if (isObject(data)) {
      body = data as Partial<HealthResponse>;
    }
    return body;
  }

  private async systemStatus(origin: string): Promise<HttpResponse> {
    const connectError = new Error("Could not check this group's website. It may be unavailable or may not use NGX Ramblers. Try again or choose another group.");
    const response = await this.nativeHttp.request({
      url: `${origin}/api/system-status`,
      method: "GET",
      connectTimeout: 10000,
      readTimeout: 10000
    }).catch(() => {
      throw connectError;
    });
    const body = this.healthBody(response.data);
    if ((response.status === 503 && body?.group) || (response.status >= 200 && response.status < 300)) {
      return response;
    } else {
      throw connectError;
    }
  }

  private resolvedOrigin(origin: string, responseUrl: string): string {
    const resolved = new URL(responseUrl);
    const requested = new URL(origin);
    const sameSite = resolved.hostname.replace(/^www\./, "") === requested.hostname.replace(/^www\./, "")
      && resolved.port === requested.port;
    if (resolved.protocol === "https:" && sameSite && !resolved.username && !resolved.password) {
      return resolved.origin;
    } else {
      throw new Error("The group website redirected to an unexpected address. Choose the group again.");
    }
  }

  canonicalOrigin(origin: string): Promise<string> {
    const existing = this.canonicalOrigins.get(origin);
    if (existing) {
      return existing;
    } else {
      const pending = this.nativeHttp.request({url: `${origin}/api/health`, method: "GET", connectTimeout: 10000, readTimeout: 10000})
        .then(response => this.resolvedOrigin(origin, response.url)).catch(error => {
          this.canonicalOrigins.delete(origin);
          throw error;
        });
      this.canonicalOrigins.set(origin, pending);
      return pending;
    }
  }

  needsChooser(): boolean {
    return Capacitor.isNativePlatform() && isNativeLocalShell() && !nativeWalkingSite();
  }

  openSelectedGroup(): boolean {
    const origin = nativeWalkingSite();
    let opened = false;
    if (Capacitor.isNativePlatform() && isNativeLocalShell() && origin) {
      openNativeGroupApp(origin);
      opened = true;
    }
    return opened;
  }

  origin(): string | null {
    return nativeWalkingSite();
  }

  async check(rawUrl: string, groupCode: string | null = null): Promise<NativeWalkingSite> {
    const origin = parseHttpsOrigin(rawUrl);
    if (!origin) {
      throw new Error("Enter a valid HTTPS group website.");
    } else {
      const response = await this.systemStatus(origin);
      const resolvedOrigin = this.resolvedOrigin(origin, response.url);
      const health = this.healthBody(response.data);
      const name = (health?.group?.shortName || "").trim();
      if (!name || ![HealthStatus.OK, HealthStatus.DEGRADED].includes(health?.status)) {
        throw new Error("This group's website does not support NGX Ramblers. This app works with groups using NGX Ramblers.");
      } else if (groupCode && health.group.groupCode !== groupCode) {
        throw new Error("This website belongs to a different group. Choose another group to continue.");
      } else if (health.status !== HealthStatus.OK) {
        throw new Error("This group's NGX website is temporarily unavailable. Please try again later.");
      } else {
        return {origin: resolvedOrigin, name};
      }
    }
  }

  async connect(rawUrl: string, groupCode: string | null = null): Promise<NativeWalkingSite> {
    const site = await this.check(rawUrl, groupCode);
    if (Capacitor.isNativePlatform()) {
      await this.navigation.selectSite({origin: site.origin});
    }
    saveNativeWalkingSite(site.origin);
    return site;
  }

  async clear(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.navigation.selectSite({origin: ""});
    }
    saveNativeWalkingSite(null);
    window.localStorage.removeItem(StoredValue.AUTH_TOKEN);
    window.localStorage.removeItem(StoredValue.APP_LAST_URL);
  }
}
