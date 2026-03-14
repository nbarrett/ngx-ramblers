import { WalksConfig } from "../../../../projects/ngx-ramblers/src/app/models/walks-config.model";

export function createWalksConfig(): WalksConfig {
  return {
    milesPerHour: 2.5,
    requireRiskAssessment: true,
    requireFinishTime: true,
    requireWalkLeaderDisplayName: true
  };
}
