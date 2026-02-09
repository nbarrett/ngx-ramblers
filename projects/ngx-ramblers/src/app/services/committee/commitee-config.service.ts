import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { CommitteeConfig, CommitteeMember, DEFAULT_COST_PER_MILE, RoleType } from "../../models/committee.model";
import { ConfigKey } from "../../models/config.model";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { CommitteeReferenceData } from "./committee-reference-data";
import { map } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class CommitteeConfigService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeConfigService", NgxLoggerLevel.ERROR);
  private config = inject(ConfigService);
  private memberLoginService = inject(MemberLoginService);
  private committeeReferenceDataSubject = new ReplaySubject<CommitteeReferenceData>();
  private committeeCommitteeConfigSubject = new ReplaySubject<CommitteeConfig>();

  constructor() {
    this.refreshConfig();
  }

  emptyCommitteeMember(): CommitteeMember {
    return {
      description: null,
      email: null,
      fullName: null,
      memberId: null,
      nameAndDescription: null,
      type: null,
      roleType: RoleType.COMMITTEE_MEMBER
    }
  };

  refreshConfig(): void {
    this.config.queryConfig<CommitteeConfig>(ConfigKey.COMMITTEE, {
      roles: [],
      contactUs: {
        chairman: this.emptyCommitteeMember(),
        secretary: this.emptyCommitteeMember(),
        treasurer: this.emptyCommitteeMember(),
        membership: this.emptyCommitteeMember(),
        social: this.emptyCommitteeMember(),
        walks: this.emptyCommitteeMember(),
        support: this.emptyCommitteeMember()
      },
      fileTypes: [],
      expenses: {costPerMile: DEFAULT_COST_PER_MILE}
    }).then((queriedConfig: CommitteeConfig) => {
      const committeeConfig = this.applyNameAndDescription(this.migrateConfig(queriedConfig));
      this.logger.info("notifying subscribers with committeeConfig:", committeeConfig);
      this.committeeReferenceDataSubject.next(CommitteeReferenceData.create(committeeConfig, this.memberLoginService));
      this.committeeCommitteeConfigSubject.next(committeeConfig);
    });
  }

  private migrateConfig(queriedConfig: CommitteeConfig) {
    if (!queriedConfig.roles) {
      const committeeConfig: CommitteeConfig = {
        roles: this.toCommitteeMembers(queriedConfig),
        fileTypes: queriedConfig.fileTypes,
        expenses: queriedConfig.expenses
      };
      this.logger.info("migrating old contactUs data structure:", queriedConfig, "to roles:", committeeConfig);
      return committeeConfig;
    } else {
      this.logger.info("no migration required for:", queriedConfig);
      return queriedConfig;
    }
  }

  private toCommitteeMembers(committeeConfig: CommitteeConfig): CommitteeMember[] {
    return map(committeeConfig?.contactUs, (data: CommitteeMember, type) => ({
      type,
      roleType: RoleType.COMMITTEE_MEMBER,
      fullName: data.fullName,
      memberId: data.memberId,
      nameAndDescription: this.nameAndDescriptionFrom(data),
      description: data.description,
      email: data.email,
      vacant: data.vacant
    })).filter(item => !item.vacant) || [];
  }

  private applyNameAndDescription(config: CommitteeConfig): CommitteeConfig {
    if (!config?.roles) {
      return config;
    }
    return {
      ...config,
      roles: config.roles.map(role => ({
        ...role,
        nameAndDescription: this.nameAndDescriptionFrom(role)
      }))
    };
  }

  public nameAndDescriptionFrom(data: CommitteeMember) {
    const description = (data.description || "").trim();
    const fullName = (data.fullName || "").trim();
    if (description && fullName && description.toLowerCase() !== fullName.toLowerCase()) {
      return `${description} (${fullName})`;
    }
    return description || fullName;
  }

  saveConfig(config: CommitteeConfig) {
    return this.config.saveConfig<CommitteeConfig>(ConfigKey.COMMITTEE, config);
  }

  public committeeReferenceDataEvents(): Observable<CommitteeReferenceData> {
    return this.committeeReferenceDataSubject.asObservable();
  }

  public committeeConfigEvents(): Observable<CommitteeConfig> {
    return this.committeeCommitteeConfigSubject.asObservable();
  }

}
