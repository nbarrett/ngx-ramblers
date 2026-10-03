import { firstCompleted, ROUTE_FOLLOW_NETWORK_TIMEOUT_MS } from "../../models/route-follow.model";
import { LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { inject, Injectable } from "@angular/core";
import { MemberLoginService } from "../member/member-login.service";
import { WalksConfigService } from "../system/walks-config.service";
import { UiActionsService } from "../ui-actions.service";
import { StoredValue } from "../../models/ui-actions";
import { DEFAULT_MOBILE_APP_CONFIG, MobileAppConfig, MobileAppAction, WalksConfig } from "../../models/walks-config.model";
import { mobileAppAccessPermitted } from "../../functions/mobile-app-access";

@Injectable({providedIn: "root"})
export class MobileAppAccessService {
  private walksConfig = inject(WalksConfigService);
  private memberLogin = inject(MemberLoginService);

  private uiActions = inject(UiActionsService);
  private cachedConfig = this.uiActions.initialObjectValueFor<MobileAppConfig>(StoredValue.APP_MOBILE_CONFIG, null);

  constructor() {
    this.walksConfig.events().subscribe(config => {
      this.cachedConfig = {...DEFAULT_MOBILE_APP_CONFIG, ...config.mobileApp};
      this.uiActions.saveValueFor(StoredValue.APP_MOBILE_CONFIG, this.cachedConfig);
    });
  }

  private logger = inject(LoggerFactory).createLogger("MobileAppAccessService", NgxLoggerLevel.ERROR);

  async ready(): Promise<void> {
    if (navigator.onLine) {
      try {
        await firstCompleted(this.walksConfig.walksConfigLoaded(), ROUTE_FOLLOW_NETWORK_TIMEOUT_MS, "Mobile app permission check timed out");
      } catch (error) {
        this.logger.warn("Mobile app permissions could not be refreshed", error);
      }
    }
  }

  allowed(action: MobileAppAction): boolean {
    const config = this.walksConfig.walksConfig();
    return !!(config || this.cachedConfig) && mobileAppAccessPermitted({mobileApp: config?.mobileApp || this.cachedConfig} as WalksConfig, action, this.memberLogin.loggedInMember());
  }
}
