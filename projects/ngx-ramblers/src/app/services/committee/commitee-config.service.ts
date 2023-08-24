import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, ReplaySubject } from "rxjs";
import { CommitteeConfig, CommitteeMember } from "../../models/committee.model";
import { ConfigKey } from "../../models/config.model";
import { ConfigService } from "../config.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { CommitteeReferenceData } from "./committee-reference-data";

@Injectable({
  providedIn: "root"
})
export class CommitteeConfigService {

  private subject = new ReplaySubject<CommitteeReferenceData>();
  private logger: Logger;

  constructor(private config: ConfigService,
              private memberLoginService: MemberLoginService,
              private loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeConfigService", NgxLoggerLevel.OFF);
    this.getConfig();
  }

  getConfig() {
    const emptyCommitteeMember: CommitteeMember = {
      description: null,
      email: null,
      fullName: null,
      memberId: null,
      nameAndDescription: null,
      type: null,
    };
    this.config.queryConfig<CommitteeConfig>(ConfigKey.COMMITTEE, {
      contactUs: {
        chairman: emptyCommitteeMember,
        secretary: emptyCommitteeMember,
        treasurer: emptyCommitteeMember,
        membership: emptyCommitteeMember,
        social: emptyCommitteeMember,
        walks: emptyCommitteeMember,
        support: emptyCommitteeMember
      },
      fileTypes: []
    }).then((committeeConfig: CommitteeConfig) => {
      this.logger.info("notifying subscribers with committeeConfig:", committeeConfig);
      this.subject.next(CommitteeReferenceData.create(committeeConfig, this.memberLoginService));
    });
  }

  saveConfig(config: CommitteeConfig) {
    return this.config.saveConfig<CommitteeConfig>(ConfigKey.COMMITTEE, config);
  }

  public events(): Observable<CommitteeReferenceData> {
    return this.subject.asObservable();
  }

}
