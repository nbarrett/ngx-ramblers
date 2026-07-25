const JOINT_LEADER_SEPARATOR = ";";
const JOINT_LEADER_DISPLAY_SEPARATOR = "; ";

export function jointWalkLeaderNames(walkLeaderNames: string): string[] {
  return (walkLeaderNames || "")
    .split(JOINT_LEADER_SEPARATOR)
    .map(name => name.trim())
    .filter(name => !!name);
}

export function isJointWalkLeaderName(walkLeaderNames: string): boolean {
  return jointWalkLeaderNames(walkLeaderNames).length > 1;
}

export function normalisedWalkLeaderName(walkLeaderNames: string): string {
  const names = jointWalkLeaderNames(walkLeaderNames);
  return names.length > 0 ? names.join(JOINT_LEADER_DISPLAY_SEPARATOR) : walkLeaderNames;
}

export function firstWalkLeaderName(walkLeaderNames: string): string {
  const names = jointWalkLeaderNames(walkLeaderNames);
  return names.length > 0 ? names[0] : walkLeaderNames;
}

export function jointWalkLeaderDisplayName(walkLeaderNames: string, displayNameFor: (name: string) => string): string {
  const displayNames = jointWalkLeaderNames(walkLeaderNames).map(displayNameFor).filter(name => !!name);
  return displayNames.length > 0 ? displayNames.join(JOINT_LEADER_DISPLAY_SEPARATOR) : null;
}

export function normaliseWalkLeaderNameForCompare(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function walkLeaderNameMatches(localName: string, ramblersName: string): boolean {
  const local = normaliseWalkLeaderNameForCompare(localName);
  const ramblers = normaliseWalkLeaderNameForCompare(ramblersName);
  if (!local && !ramblers) {
    return true;
  } else if (!local || !ramblers) {
    return false;
  } else if (local === ramblers) {
    return true;
  } else {
    return initialSurnameFormMatches(local, ramblers);
  }
}

function initialSurnameFormMatches(local: string, ramblers: string): boolean {
  const localTokens = local.split(" ").filter(token => !!token);
  const ramblersTokens = ramblers.split(" ").filter(token => !!token);
  if (localTokens.length < 2 || ramblersTokens.length < 2) {
    return false;
  }
  const localFirst = localTokens[0];
  const ramblersFirst = ramblersTokens[0];
  const firstNameCompatible = localFirst === ramblersFirst
    || localFirst.startsWith(ramblersFirst)
    || ramblersFirst.startsWith(localFirst);
  if (!firstNameCompatible) {
    return false;
  }
  const localSurname = localTokens.slice(1).join(" ");
  const ramblersSurname = ramblersTokens.slice(1).join(" ");
  if (localSurname === ramblersSurname) {
    return true;
  } else if (localSurname.length === 1 && ramblersSurname.startsWith(localSurname)) {
    return true;
  } else if (ramblersSurname.length === 1 && localSurname.startsWith(ramblersSurname)) {
    return true;
  } else {
    const localLast = localTokens[localTokens.length - 1];
    const ramblersLast = ramblersTokens[ramblersTokens.length - 1];
    if (localLast.length === 1 && ramblersLast.startsWith(localLast)) {
      return true;
    } else if (ramblersLast.length === 1 && localLast.startsWith(ramblersLast)) {
      return true;
    } else {
      return false;
    }
  }
}

export function walkLeaderNamesMatch(localWalkLeaders: string, ramblersWalkLeaders: string): boolean {
  const localNames = jointWalkLeaderNames(normalisedWalkLeaderName(localWalkLeaders));
  const ramblersNames = jointWalkLeaderNames(normalisedWalkLeaderName(ramblersWalkLeaders));
  if (localNames.length === 0 && ramblersNames.length === 0) {
    return true;
  } else if (localNames.length !== ramblersNames.length) {
    return false;
  } else {
    return localNames.every(localName => ramblersNames.some(ramblersName => walkLeaderNameMatches(localName, ramblersName)))
      && ramblersNames.every(ramblersName => localNames.some(localName => walkLeaderNameMatches(localName, ramblersName)));
  }
}
