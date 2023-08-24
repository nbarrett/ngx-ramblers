import { Injectable } from "@angular/core";
import { CommitteeConfig, CommitteeFileType, CommitteeMember } from "../models/committee.model";
import { ConfigKey } from "../models/config.model";
import { ConfigService } from "./config.service";

@Injectable({
  providedIn: "root"
})
export class CommitteeConfigService {

  constructor(private config: ConfigService) {
  }

  async getConfig(): Promise<CommitteeConfig> {
    const emptyCommitteeMember: CommitteeMember = {
      description: null,
      email: null,
      fullName: null,
      memberId: null,
      nameAndDescription: null,
      type: null,
    };
    return await this.config.queryConfig<CommitteeConfig>(ConfigKey.COMMITTEE, {
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
    });
  }

  saveConfig(config: CommitteeConfig) {
    return this.config.saveConfig<CommitteeConfig>(ConfigKey.COMMITTEE, config);
  }

}
