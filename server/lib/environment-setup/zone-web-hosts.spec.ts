import expect from "expect";
import { describe, it } from "mocha";
import { webFacingHostnamesFromDns } from "./zone-web-hosts";
import { DnsRecordResult } from "../cloudflare/cloudflare.model";

function rec(type: string, name: string): DnsRecordResult {
  return {
    id: name,
    type: type as DnsRecordResult["type"],
    name,
    content: "",
    proxied: false,
    ttl: 1,
    created_on: "",
    modified_on: ""
  };
}

describe("webFacingHostnamesFromDns", () => {
  it("keeps staging and www and drops mail, acme and wildcard records", () => {
    const names = webFacingHostnamesFromDns([
      rec("A", "staging.stagwalkers.org.uk"),
      rec("A", "www.stagwalkers.org.uk"),
      rec("A", "stagwalkers.org.uk"),
      rec("A", "*.stagwalkers.org.uk"),
      rec("CNAME", "mail.stagwalkers.org.uk"),
      rec("CNAME", "_acme-challenge.www.stagwalkers.org.uk"),
      rec("MX", "stagwalkers.org.uk")
    ], "stagwalkers.org.uk");
    expect(names).toEqual(["staging.stagwalkers.org.uk", "www.stagwalkers.org.uk"]);
  });
});
