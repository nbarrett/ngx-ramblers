import { values } from "es-toolkit/compat";
import { RankedLeaderRow } from "../models/agm-stats.model";
import { LeaderStats } from "../models/group-event.model";
import { sortBy } from "./arrays";
import { trimmedNamePart } from "./member-names";
import { entries } from "./object-utils";
import { walksManagerWalkLeaderNameFromGroupEvent } from "./walks/walk-leader-fields";

export const UNKNOWN_WALK_LEADER_NAME = "Unknown";
export const UNKNOWN_WALK_LEADER_KEY = "unknown";

export function isUnknownWalkLeaderName(name: unknown): boolean {
  const trimmed = trimmedNamePart(name);
  return !trimmed || trimmed.toLowerCase() === "unknown";
}

export function walkLeaderAggregateKey(leader: {id?: unknown; name?: unknown; email?: unknown}): string {
  const name = trimmedNamePart(leader.name);
  const email = trimmedNamePart(leader.email).toLowerCase();
  const id = trimmedNamePart(leader.id);
  if (isUnknownWalkLeaderName(name)) {
    return UNKNOWN_WALK_LEADER_KEY;
  } else if (email) {
    return email;
  } else if (id) {
    return id;
  } else {
    return name.toLowerCase();
  }
}

export function isUnknownWalkLeader(leader: {id?: unknown; name?: unknown}): boolean {
  return walkLeaderAggregateKey(leader) === UNKNOWN_WALK_LEADER_KEY;
}

export function walkLeaderIdentityTokens(walk: any): string[] {
  const displayName = trimmedNamePart(walk?.fields?.contactDetails?.displayName);
  const listedName = walksManagerWalkLeaderNameFromGroupEvent(walk?.groupEvent);
  const name = displayName || listedName;
  const memberId = trimmedNamePart(walk?.fields?.contactDetails?.memberId);
  const walkLeaderId = trimmedNamePart(walk?.groupEvent?.walk_leader?.id);
  const email = trimmedNamePart(walk?.fields?.contactDetails?.email).toLowerCase();
  const tokens: string[] = [];
  if (email) {
    tokens.push(`email:${email}`);
  }
  if (memberId) {
    tokens.push(`id:${memberId}`);
  }
  if (walkLeaderId) {
    tokens.push(`id:${walkLeaderId}`);
  }
  if (name && !isUnknownWalkLeaderName(name)) {
    tokens.push(`name:${name.toLowerCase()}`);
  }
  return tokens;
}

export function leaderStatsIdentityTokens(leader: {id?: unknown; name?: unknown; email?: unknown}): string[] {
  const email = trimmedNamePart(leader.email).toLowerCase();
  const id = trimmedNamePart(leader.id);
  const name = trimmedNamePart(leader.name);
  const tokens: string[] = [];
  if (email) {
    tokens.push(`email:${email}`);
  }
  if (id && id !== UNKNOWN_WALK_LEADER_KEY) {
    if (id.includes("@")) {
      tokens.push(`email:${id.toLowerCase()}`);
    } else {
      tokens.push(`id:${id}`);
      tokens.push(`name:${id.toLowerCase()}`);
    }
  }
  if (name && !isUnknownWalkLeaderName(name)) {
    tokens.push(`name:${name.toLowerCase()}`);
  }
  return [...new Set(tokens)];
}

export function historicalLeaderTokens(walks: any[]): Set<string> {
  return (walks || []).reduce((tokens, walk) => {
    walkLeaderIdentityTokens(walk).forEach(token => tokens.add(token));
    return tokens;
  }, new Set<string>());
}

export function newLeadersFromPeriod(periodLeaders: LeaderStats[], historicalTokens: Set<string>): LeaderStats[] {
  return (periodLeaders || []).filter(leader => {
    if (isUnknownWalkLeader(leader)) {
      return false;
    } else {
      const tokens = leaderStatsIdentityTokens(leader);
      return tokens.length > 0 && !tokens.some(token => historicalTokens.has(token));
    }
  });
}

export function leaderIdentityFromWalk(walk: any): {id: string; name: string; email: string} {
  const displayName = trimmedNamePart(walk?.fields?.contactDetails?.displayName);
  const memberId = trimmedNamePart(walk?.fields?.contactDetails?.memberId);
  const listedName = walksManagerWalkLeaderNameFromGroupEvent(walk?.groupEvent);
  const name = displayName || listedName;
  const email = trimmedNamePart(walk?.fields?.contactDetails?.email);
  if (isUnknownWalkLeaderName(name) && !memberId && !email) {
    return {id: UNKNOWN_WALK_LEADER_KEY, name: UNKNOWN_WALK_LEADER_NAME, email: ""};
  } else {
    return {
      id: walkLeaderAggregateKey({id: memberId, name, email}),
      name: isUnknownWalkLeaderName(name) ? UNKNOWN_WALK_LEADER_NAME : name,
      email
    };
  }
}

export function leaderStatsFromWalks(walks: any[]): LeaderStats[] {
  const aggregated = (walks ?? []).reduce((acc, walk) => {
    const identity = leaderIdentityFromWalk(walk);
    const existing = acc.get(identity.id) || {
      id: identity.id,
      name: identity.name,
      email: identity.email,
      walkCount: 0,
      totalMiles: 0
    };
    existing.walkCount += 1;
    existing.totalMiles += walk?.groupEvent?.distance_miles || 0;
    if (!existing.name && identity.name) {
      existing.name = identity.name;
    }
    if (!existing.email && identity.email) {
      existing.email = identity.email;
    }
    acc.set(identity.id, existing);
    return acc;
  }, new Map<string, LeaderStats>());
  return Array.from(aggregated.values())
    .map(leader => asLeaderStats(leader))
    .sort(sortBy("-walkCount", "-totalMiles"));
}

export function asLeaderStats(leader: Partial<LeaderStats> & {_id?: unknown}): LeaderStats {
  const name = trimmedNamePart(leader.name);
  return {
    id: trimmedNamePart(leader._id) || trimmedNamePart(leader.id),
    name: isUnknownWalkLeaderName(name) ? UNKNOWN_WALK_LEADER_NAME : name,
    email: trimmedNamePart(leader.email),
    walkCount: leader.walkCount || 0,
    totalMiles: Math.round((leader.totalMiles || 0) * 10) / 10
  };
}

export function aggregateLeaderStats(leaders: LeaderStats[]): RankedLeaderRow[] {
  const aggregate = leaders.reduce((acc, leader) => {
    const current = asLeaderStats(leader);
    const currentKey = walkLeaderAggregateKey(current);
    const matched = entries(acc).find(([, existingLeader]) => {
      const existingKey = walkLeaderAggregateKey(existingLeader);
      return existingKey === currentKey
        || (!isUnknownWalkLeaderName(current.name) && current.name.toLowerCase() === existingLeader.name.toLowerCase());
    });
    if (matched) {
      const existing = acc[matched[0]];
      acc[matched[0]] = {
        ...existing,
        walkCount: existing.walkCount + current.walkCount,
        totalMiles: existing.totalMiles + current.totalMiles
      };
    } else if (currentKey) {
      acc[currentKey] = isUnknownWalkLeaderName(current.name) ? {...current, id: UNKNOWN_WALK_LEADER_KEY} : current;
    }
    return acc;
  }, {} as Record<string, LeaderStats>);

  return values(aggregate)
    .sort(sortBy("-walkCount", "-totalMiles"))
    .map((leader, index) => ({
      ...leader,
      rank: index + 1,
      totalMiles: Math.round(leader.totalMiles * 10) / 10
    }));
}
