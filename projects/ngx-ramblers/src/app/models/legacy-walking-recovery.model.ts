import { RouteFollowSession, RouteFollowSummary } from "./route-follow.model";

export interface LegacyWalkingRoute extends RouteFollowSummary {
  key: string;
}

export interface LegacyWalkingRecoveryState {
  routes: LegacyWalkingRoute[];
  session: RouteFollowSession | null;
}
