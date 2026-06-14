import { CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const LIST_ITEM_STYLE = (baseUrl: string): string =>
  `font-weight: normal; background-image: url(${baseUrl}/assets/images/ramblers/icons/ramblers_icon_2_arrow_forward_rgb.png); padding: 3px 0px 9px 24px; list-style: none outside; background-repeat: no-repeat; background-position: 0px 7px; background-size: 18px;`;

const EMAIL_LINK_STYLE = "color: #c05711; font-weight: normal; text-decoration: underline;";

function nameAndRole(item: CommitteeMember): string {
  return item.description && item.description !== item.fullName
    ? `${item.fullName} - ${item.description}`
    : item.fullName;
}

function signoffListItem(item: CommitteeMember, baseUrl: string): string {
  const emailLink = item.email
    ? ` - <a href="mailto:${item.email}" style="${EMAIL_LINK_STYLE}">${item.email}</a>`
    : "";
  return `<li style="${LIST_ITEM_STYLE(baseUrl)}">${nameAndRole(item)}${emailLink}</li>`;
}

export function signoffNamesHtml(committeeRoles: CommitteeMember[], signOffRoles: string[], baseUrl: string, signOffText?: string): string {
  const text = signOffText?.trim() ? `<p style="margin: 0 0 8px;">${signOffText.trim()}</p>` : "";
  const items = (signOffRoles ?? [])
    .map(role => committeeRoles?.find(item => item.type === role))
    .filter(item => !!item?.fullName)
    .map(item => signoffListItem(item, baseUrl));
  const list = items.length ? `<ul>${items.join("")}</ul>` : "";
  return `${text}${list}`;
}

export function signoffHtmlForConfig(notifConfig: NotificationConfig, committeeRoles: CommitteeMember[], baseUrl: string): string {
  return signoffNamesHtml(committeeRoles, notifConfig?.signOffRoles, baseUrl, notifConfig?.signOffText);
}
