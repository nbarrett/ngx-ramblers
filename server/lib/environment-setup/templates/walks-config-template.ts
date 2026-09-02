import { DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS, WalksConfig } from "../../../../projects/ngx-ramblers/src/app/models/walks-config.model";

export function createWalksConfig(): WalksConfig {
  return {
    milesPerHour: 2.5,
    requireRiskAssessment: true,
    riskAssessmentSections: DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS,
    requireFinishTime: true,
    requireWalkLeaderDisplayName: true
  };
}
