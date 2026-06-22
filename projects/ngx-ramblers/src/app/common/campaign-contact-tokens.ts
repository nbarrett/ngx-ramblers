import { toPairs } from "es-toolkit/compat";
export function toCampaignContactTokens(html: string): string {
  const contactTokenByMergeField: Record<string, string> = {
    FULL_NAME: "{{contact.FIRSTNAME}} {{contact.LASTNAME}}",
    FNAME: "{{contact.FIRSTNAME}}",
    LNAME: "{{contact.LASTNAME}}",
    EMAIL: "{{contact.EMAIL}}",
    MEMBER_NUM: "{{contact.MEMBER_NUM}}",
    MEMBER_EXP: "{{contact.MEMBER_EXP}}",
    USERNAME: "{{contact.USERNAME}}"
  };
  return toPairs(contactTokenByMergeField).reduce(
    (content, [mergeField, contactToken]) =>
      content.replace(new RegExp(`\\{\\{\\s*params\\.memberMergeFields\\.${mergeField}\\s*}}`, "g"), contactToken),
    html
  );
}
