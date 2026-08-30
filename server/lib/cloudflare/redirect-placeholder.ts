import { RedirectPlaceholderPlan } from "./cloudflare.model";

export function redirectPlaceholderPlan(records: { type: string; proxied?: boolean }[]): RedirectPlaceholderPlan {
  const existingCname = records.find(record => record.type === "CNAME");
  const existingA = records.find(record => record.type === "A");
  if (existingCname?.proxied) {
    return RedirectPlaceholderPlan.LEAVE_PROXIED_CNAME;
  } else if (existingCname) {
    return RedirectPlaceholderPlan.REPLACE_DNS_ONLY_CNAME;
  } else if (!existingA) {
    return RedirectPlaceholderPlan.CREATE_PLACEHOLDER;
  } else if (existingA.proxied) {
    return RedirectPlaceholderPlan.LEAVE_PROXIED_A;
  } else {
    return RedirectPlaceholderPlan.PROXY_EXISTING_A;
  }
}
