export const RAMBLERS_MY_DETAILS_URL = "https://www.ramblers.org.uk/my-account/my-details";
export const RAMBLERS_MY_DETAILS_TRAIL = "Ramblers › My Account Home › My details";
export const HEAD_OFFICE_FIELD_HELP_ID = "head-office-field-help";

export function ramblersMyDetailsLinkHtml(): string {
  return `<a href="${RAMBLERS_MY_DETAILS_URL}">${RAMBLERS_MY_DETAILS_TRAIL}</a>`;
}

export function appliedFromHeadOfficeHelpHtml(): string {
  return `<p>The fields marked <strong>Applied locally (from Head Office)</strong> are now maintained at Ramblers Head Office. Updates via ${ramblersMyDetailsLinkHtml()}.</p>`;
}
