import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { applyCommitteeRoleDefaultSender, BuiltInRole, CommitteeConfig, CommitteeMember, committeeMeetingTypesFromFileTypes, CONTACT_US_LABEL, CONTACT_US_TYPE, DEFAULT_COST_PER_MILE, RoleType, roleEmailAddresses } from "../../models/committee.model";
import { normaliseEmail } from "../../functions/strings";
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
  private latestConfig: CommitteeConfig | null = null;

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
      meetingTypes: [],
      expenses: {costPerMile: DEFAULT_COST_PER_MILE}
    }).then((queriedConfig: CommitteeConfig) => {
      const committeeConfig = this.applyNameAndDescription(this.migrateConfig(queriedConfig));
      this.logger.info("notifying subscribers with committeeConfig:", committeeConfig);
      this.publishConfig(committeeConfig);
    });
  }

  private migrateConfig(queriedConfig: CommitteeConfig) {
    const withRoles = !queriedConfig.roles
      ? {
        roles: this.toCommitteeMembers(queriedConfig),
        fileTypes: queriedConfig.fileTypes,
        expenses: queriedConfig.expenses
      }
      : queriedConfig;
    if (!queriedConfig.roles) {
      this.logger.info("migrating old contactUs data structure:", queriedConfig, "to roles:", withRoles);
    }
    return {
      ...withRoles,
      meetingTypes: committeeMeetingTypesFromFileTypes(withRoles.fileTypes)
    };
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
      roles: config.roles.map(role => {
        const normalised = this.normaliseContactUsSystemRole(role);
        return {...normalised, nameAndDescription: this.nameAndDescriptionFrom(normalised)};
      })
    };
  }

  private normaliseContactUsSystemRole(role: CommitteeMember): CommitteeMember {
    const isContactUs = role.builtInRoleMapping === BuiltInRole.CONTACT_US || role.type === CONTACT_US_TYPE;
    if (!isContactUs) {
      return role;
    }
    return {
      ...role,
      type: CONTACT_US_TYPE,
      builtInRoleMapping: BuiltInRole.CONTACT_US,
      roleType: RoleType.SYSTEM_ROLE,
      description: CONTACT_US_LABEL,
      fullName: CONTACT_US_LABEL,
      vacant: false
    };
  }

  public nameAndDescriptionFrom(data: CommitteeMember) {
    const description = (data.description || "").trim();
    const fullName = (data.fullName || "").trim();
    if (description && fullName && description.toLowerCase() !== fullName.toLowerCase()) {
      const fullNameAlreadyBracketed = fullName.startsWith("(") && fullName.endsWith(")");
      return fullNameAlreadyBracketed ? `${description} ${fullName}` : `${description} (${fullName})`;
    }
    return description || fullName;
  }

  saveConfig(config: CommitteeConfig) {
    return this.config.saveConfig<CommitteeConfig>(ConfigKey.COMMITTEE, config);
  }

  applyDefaultSender(roleType: string, email: string): Promise<void> {
    const config = this.latestConfig;
    const currentRole = config?.roles.find(role => role.type === roleType) ?? null;
    if (!this.memberLoginService.allowMemberAdminEdits()) {
      return Promise.reject("You cannot change committee email addresses here.");
    } else if (!config || !currentRole) {
      return Promise.reject("Committee settings could not be loaded.");
    } else {
      const updatedRole = applyCommitteeRoleDefaultSender(currentRole, email);
      const nextEmails = roleEmailAddresses(updatedRole).map(address => normaliseEmail(address));
      const lost = roleEmailAddresses(currentRole).filter(address => !nextEmails.includes(normaliseEmail(address)));
      if (lost.length > 0) {
        return Promise.reject("That change would remove an address from the role, so it was not saved.");
      } else {
        const next = {
          ...config,
          roles: config.roles.map(role => role.type === roleType ? updatedRole : role)
        };
        this.publishConfig(next);
        return this.saveConfig(next)
          .then(() => {
            this.refreshConfig();
          })
          .catch(error => {
            this.refreshConfig();
            return Promise.reject(error);
          });
      }
    }
  }

  private publishConfig(committeeConfig: CommitteeConfig): void {
    this.latestConfig = committeeConfig;
    this.committeeReferenceDataSubject.next(CommitteeReferenceData.create(committeeConfig, this.memberLoginService));
    this.committeeCommitteeConfigSubject.next(committeeConfig);
  }

  public committeeReferenceDataEvents(): Observable<CommitteeReferenceData> {
    return this.committeeReferenceDataSubject.asObservable();
  }

  public committeeConfigEvents(): Observable<CommitteeConfig> {
    return this.committeeCommitteeConfigSubject.asObservable();
  }

  public committeeConfig(): CommitteeConfig | null {
    return this.latestConfig;
  }

}
