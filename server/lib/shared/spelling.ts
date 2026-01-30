export function toFlyioOrganisation(ukSpelling: string): string {
  return ukSpelling;
}

export function fromFlyioOrganisation(usSpelling: string): string {
  return usSpelling;
}

export function normaliseMemory(memory: string | number): string {
  const memStr = String(memory);
  if (memStr.includes("mb")) {
    return memStr;
  }
  return `${memStr}mb`;
}
