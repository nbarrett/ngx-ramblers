import { MemberLoginService } from "../member/member-login.service";
import { inject, Injectable } from "@angular/core";
import { OsMapsAccountScope, OsMapsRouteListing, OsMapsRouteListSnapshot } from "../../models/os-maps-export.model";
import { StoredValue } from "../../models/ui-actions";

@Injectable({
  providedIn: "root"
})
export class OsMapsRouteListCacheService {
  private memberLogin = inject(MemberLoginService);
  private memory: OsMapsRouteListSnapshot | null = null;

  snapshot(account: OsMapsAccountScope): OsMapsRouteListing | null {
    const stored = this.currentSnapshot();
    return stored?.listings[account] || null;
  }

  save(account: OsMapsAccountScope, listing: OsMapsRouteListing): void {
    const memberId = this.memberId();
    const previous = this.currentSnapshot() || {memberId, listings: {}};
    const snapshot: OsMapsRouteListSnapshot = {
      memberId,
      listings: {...previous.listings, [account]: listing}
    };
    this.memory = snapshot;
    try {
      window.sessionStorage.setItem(StoredValue.OS_MAPS_ROUTE_LIST_CACHE, JSON.stringify(snapshot));
    } catch {
      this.memory = snapshot;
    }
  }

  private currentSnapshot(): OsMapsRouteListSnapshot | null {
    const memberId = this.memberId();
    if (this.memory && this.memory.memberId === memberId) {
      return this.memory;
    } else {
      return this.readStored();
    }
  }

  private readStored(): OsMapsRouteListSnapshot | null {
    try {
      const raw = window.sessionStorage.getItem(StoredValue.OS_MAPS_ROUTE_LIST_CACHE);
      if (!raw) {
        return null;
      } else {
        const parsed = JSON.parse(raw) as OsMapsRouteListSnapshot;
        return (parsed.memberId || null) === this.memberId() ? {
          memberId: parsed.memberId || null,
          listings: parsed.listings || {}
        } : null;
      }
    } catch {
      return null;
    }
  }

  private memberId(): string | null {
    return this.memberLogin.loggedInMember()?.memberId || null;
  }
}
