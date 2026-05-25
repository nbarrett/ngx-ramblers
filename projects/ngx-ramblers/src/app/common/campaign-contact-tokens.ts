export function toCampaignContactTokens(html: string): string {
  const contactTokenByMergeField: Record<string, string> = {
    FULL_NAME: "{{contact.FIRSTNAME}} {{contact.LASTNAME}}",
    FNAME: "{{contact.FIRSTNAME}}",
    LNAME: "{{contact.LASTNAME}}",
    EMAIL: "{{contact.EMAIL}}"
  };
  return Object.entries(contactTokenByMergeField).reduce(
    (content, [mergeField, contactToken]) =>
      content.replace(new RegExp(`\\{\\{\\s*params\\.memberMergeFields\\.${mergeField}\\s*}}`, "g"), contactToken),
    html
  );
}
