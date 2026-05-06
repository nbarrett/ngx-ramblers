import { CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";

export function signoffNamesHtml(committeeRoles: CommitteeMember[], signOffRoles: string[]): string {
  if (!signOffRoles?.length) return "";
  const items = signOffRoles
    .map(role => committeeRoles?.find(item => item.type === role))
    .filter(item => !!item?.fullName)
    .map(item => `<li>${item.fullName} (${item.description})</li>`);
  return items.length ? `<ul>${items.join("")}</ul>` : "";
}
