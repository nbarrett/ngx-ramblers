import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { firstValueFrom, timeout } from "rxjs";
import { HealthResponse, HealthStatus } from "../../models/health.model";
import { NativeWalkingSite } from "../../models/native-route.model";
import { StoredValue } from "../../models/ui-actions";
import { nativeWalkingSite, parseHttpsOrigin, saveNativeWalkingSite } from "../../functions/native-walking";

@Injectable({
  providedIn: "root"
})
export class NativeSiteService {
  private http = inject(HttpClient);

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
