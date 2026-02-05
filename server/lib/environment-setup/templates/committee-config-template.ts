import {
  BuiltInRole,
  CommitteeConfig,
  CommitteeMember,
  DEFAULT_COST_PER_MILE,
  RoleType
} from "../../../../projects/ngx-ramblers/src/app/models/committee.model";

export interface CommitteeConfigTemplateParams {
  groupShortName: string;
}

function createCommitteeRole(
  type: string,
  description: string,
  roleType: RoleType,
  builtInRoleMapping?: BuiltInRole
): CommitteeMember {
  return {
    type,
    description,
    email: "",
    fullName: "(Vacant)",
    memberId: null,
    nameAndDescription: `(Vacant) - ${description}`,
    vacant: true,
    roleType,
    builtInRoleMapping
  };
}

export function createCommitteeConfig(params: CommitteeConfigTemplateParams): CommitteeConfig {
  const roles: CommitteeMember[] = [
    createCommitteeRole("chairman", "Chairman", RoleType.COMMITTEE_MEMBER),
    createCommitteeRole("secretary", "Secretary", RoleType.COMMITTEE_MEMBER),
    createCommitteeRole("treasurer", "Treasurer", RoleType.COMMITTEE_MEMBER, BuiltInRole.TREASURER),
    createCommitteeRole("membership", "Membership Secretary", RoleType.COMMITTEE_MEMBER),
    createCommitteeRole("walks", "Walks Coordinator", RoleType.COMMITTEE_MEMBER, BuiltInRole.WALKS_CO_ORDINATOR),
    createCommitteeRole("social", "Social Secretary", RoleType.COMMITTEE_MEMBER, BuiltInRole.SOCIAL_CO_ORDINATOR),
    createCommitteeRole("publicity", "Publicity Officer", RoleType.COMMITTEE_MEMBER),
    createCommitteeRole("webmaster", "Webmaster", RoleType.COMMITTEE_MEMBER),
    createCommitteeRole("enquiries", "Enquiries", RoleType.SYSTEM_ROLE),
    createCommitteeRole("support", "Support", RoleType.SYSTEM_ROLE)
  ];

  const roleByType = (type: string): CommitteeMember =>
    roles.find(r => r.type === type) || createCommitteeRole(type, type, RoleType.COMMITTEE_MEMBER);

  return {
    roles,
    contactUs: {
      chairman: roleByType("chairman"),
      secretary: roleByType("secretary"),
      treasurer: roleByType("treasurer"),
      membership: roleByType("membership"),
      social: roleByType("social"),
      walks: roleByType("walks"),
      support: roleByType("support")
    },
    fileTypes: [
      { description: "AGM Agenda", public: true },
      { description: "AGM Minutes", public: true },
      { description: "Committee Agenda", public: false },
      { description: "Committee Minutes", public: false },
      { description: "Annual Report", public: true },
      { description: "Financial Statement", public: false },
      { description: "Walks Programme", public: true }
    ],
    expenses: {
      costPerMile: DEFAULT_COST_PER_MILE
    }
  };
}
