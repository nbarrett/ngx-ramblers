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
