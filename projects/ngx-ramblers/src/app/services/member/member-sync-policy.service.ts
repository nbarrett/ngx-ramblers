import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { ConfigKey } from "../../models/config.model";
import { NamedEventType } from "../../models/broadcast.model";
import {
  DEFAULT_MEMBER_SYNC_POLICY,
  MemberSyncPolicy,
  MemberSyncPolicyMode
} from "../../models/member-sync-policy.model";
import { BroadcastService } from "../broadcast-service";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MemberSyncPolicyService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberSyncPolicyService", NgxLoggerLevel.ERROR);
  private configService = inject(ConfigService);
  private broadcastService = inject<BroadcastService<MemberSyncPolicy>>(BroadcastService);
  private subject = new ReplaySubject<MemberSyncPolicy>(1);
  private cachedPolicy: MemberSyncPolicy = this.cloneDefault();
  private loadedFromServer = false;

  constructor() {
    this.broadcastService.on(NamedEventType.MEMBER_LOGIN_COMPLETE, () => this.refresh());
    this.broadcastService.on(NamedEventType.MEMBER_LOGOUT_COMPLETE, () => this.refresh());
  }

  private cloneDefault(): MemberSyncPolicy {
    return {defaultMode: DEFAULT_MEMBER_SYNC_POLICY.defaultMode, overrides: {}};
  }

  private normalise(value: MemberSyncPolicy): MemberSyncPolicy {
    return {
      defaultMode: value?.defaultMode ?? DEFAULT_MEMBER_SYNC_POLICY.defaultMode,
      overrides: {...(value?.overrides ?? {})}
    };
  }

  async refresh(): Promise<MemberSyncPolicy> {
    try {
      const policy = await this.configService.queryConfig<MemberSyncPolicy>(ConfigKey.MEMBER_SYNC_POLICY, this.cloneDefault());
      this.cachedPolicy = this.normalise(policy);
      this.loadedFromServer = true;
    } catch (error) {
      this.logger.error("refresh:error", error);
      this.cachedPolicy = this.cloneDefault();
    }
    this.subject.next(this.cachedPolicy);
    return this.cachedPolicy;
  }

  hasLoaded(): boolean {
    return this.loadedFromServer;
  }

  cached(): MemberSyncPolicy {
    return this.cachedPolicy;
  }

  setLocal(value: MemberSyncPolicy): void {
    this.cachedPolicy = this.normalise(value);
  }

  events(): Observable<MemberSyncPolicy> {
    return this.subject.pipe(shareReplay(1));
  }

  effectiveMode(fieldName: string): MemberSyncPolicyMode {
    return this.effectiveModeFor(this.cachedPolicy, fieldName);
  }

  effectiveModeFor(policy: MemberSyncPolicy, fieldName: string): MemberSyncPolicyMode {
    return policy?.overrides?.[fieldName] ?? policy?.defaultMode ?? DEFAULT_MEMBER_SYNC_POLICY.defaultMode;
  }

  async save(value: MemberSyncPolicy): Promise<MemberSyncPolicy> {
    const saved: any = await this.configService.saveConfig<MemberSyncPolicy>(ConfigKey.MEMBER_SYNC_POLICY, this.normalise(value));
    this.cachedPolicy = this.normalise(saved?.value || value);
    this.subject.next(this.cachedPolicy);
    return this.cachedPolicy;
  }
}
