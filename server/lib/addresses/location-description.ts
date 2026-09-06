import { PostcodeLookupResult } from "../../../projects/ngx-ramblers/src/app/models/address-model";

const UNPARISHED = "unparished";
const POLICE_FORCE_AREA = /\b(police|constabulary)\b/i;

function distinctSegments(segments: (string | null | undefined)[]): string[] {
  return segments
    .map(segment => (segment || "").trim())
    .filter(segment => segment.length > 0 && !segment.toLowerCase().includes(UNPARISHED))
    .filter((segment, index, all) => all.findIndex(candidate => candidate.toLowerCase() === segment.toLowerCase()) === index);
}

export function postcodeDescription(result: Pick<PostcodeLookupResult, "parish" | "admin_ward" | "admin_district">): string {
  const parish = (result.parish || "").toLowerCase().includes(UNPARISHED) ? "" : result.parish;
  return distinctSegments([parish || result.admin_ward, result.admin_district]).join(", ");
}

export function withoutPoliceForceAreas(description: string): string {
  return distinctSegments(description.split(",")).filter(segment => !POLICE_FORCE_AREA.test(segment)).join(", ");
}

export function mentionsPoliceForceArea(description: string | null | undefined): boolean {
  return !!description && POLICE_FORCE_AREA.test(description);
}
