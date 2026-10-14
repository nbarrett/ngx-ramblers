import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable, InjectionToken } from "@angular/core";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { firstValueFrom, timeout } from "rxjs";
import { HealthResponse, HealthStatus } from "../../models/health.model";
import { NativeWalkingSite } from "../../models/native-route.model";
import { StoredValue } from "../../models/ui-actions";
import { nativeWalkingSite, parseHttpsOrigin, saveNativeWalkingSite } from "../../functions/native-walking";

export const NATIVE_HTTP = new InjectionToken<typeof CapacitorHttp>("NativeHttp", {
  providedIn: "root", factory: () => CapacitorHttp
});

@Injectable({
  providedIn: "root"
})
export class NativeSiteService {
  private http = inject(HttpClient);
  private readonly nativeHttp = inject(NATIVE_HTTP);
  private readonly canonicalOrigins = new Map<string, Promise<string>>();

  canonicalOrigin(origin: string): Promise<string> {
    const existing = this.canonicalOrigins.get(origin);
    if (existing) {
      return existing;
    } else {
      const pending = this.nativeHttp.request({url: `${origin}/api/health`, method: "HEAD", connectTimeout: 10000, readTimeout: 10000})
        .then(response => {
          const resolved = new URL(response.url);
          const requested = new URL(origin);
          const sameSite = resolved.hostname.replace(/^www\./, "") === requested.hostname.replace(/^www\./, "")
            && resolved.port === requested.port;
          if (resolved.protocol === "https:" && sameSite && !resolved.username && !resolved.password) {
            return resolved.origin;
          } else {
            throw new Error("The group website redirected to an unexpected address. Choose the group again.");
          }
        }).catch(error => {
          this.canonicalOrigins.delete(origin);
          throw error;
        });
      this.canonicalOrigins.set(origin, pending);
      return pending;
    }
  }

  needsChooser(): boolean {
    return Capacitor.isNativePlatform() && !nativeWalkingSite();
  }

  origin(): string | null {
    return nativeWalkingSite();
  }

  async check(rawUrl: string, groupCode: string | null = null): Promise<NativeWalkingSite> {
    const origin = parseHttpsOrigin(rawUrl);
    if (!origin) {
      throw new Error("Enter a valid HTTPS group website.");
    } else {
      const health = await firstValueFrom(this.http.get<Partial<HealthResponse>>(`${origin}/api/system-status`).pipe(timeout(10000)))
        .catch(error => {
          if (error instanceof HttpErrorResponse && error.status === 503 && error.error?.group) {
            return error.error as Partial<HealthResponse>;
          } else {
            throw new Error("Could not check this group's website. It may be unavailable or may not use NGX Ramblers. Try again or choose another group.");
          }
        });
      const name = (health?.group?.shortName || "").trim();
      if (!name || ![HealthStatus.OK, HealthStatus.DEGRADED].includes(health?.status)) {
        throw new Error("This group's website does not support NGX Ramblers. This app works with groups using NGX Ramblers.");
      } else if (groupCode && health.group.groupCode !== groupCode) {
        throw new Error("This website belongs to a different group. Choose another group to continue.");
      } else if (health.status !== HealthStatus.OK) {
        throw new Error("This group's NGX website is temporarily unavailable. Please try again later.");
      } else {
        return {origin, name};
      }
    }
  }

  async connect(rawUrl: string, groupCode: string | null = null): Promise<NativeWalkingSite> {
    const site = await this.check(rawUrl, groupCode);
    saveNativeWalkingSite(site.origin);
    return site;
  }

  clear(): void {
    saveNativeWalkingSite(null);
    window.localStorage.removeItem(StoredValue.AUTH_TOKEN);
    window.localStorage.removeItem(StoredValue.APP_LAST_URL);
  }
}
