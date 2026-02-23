import { WalksConfig } from "../../../../projects/ngx-ramblers/src/app/models/walk-notification.model";

export function createWalksConfig(): WalksConfig {
  return {
    milesPerHour: 2.5,
    requireRiskAssessment: true,
    requireFinishTime: true,
    requireWalkLeaderDisplayName: true
  };
}
