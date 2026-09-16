import expect from "expect";
import { describe, it } from "mocha";
import { unmappedHostsToOffer, webFacingHostnamesFromDns } from "./zone-web-hosts";
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

describe("unmappedHostsToOffer", () => {
  it("does not list other groups from the shared NGX zone", () => {
    expect(unmappedHostsToOffer(
      "ngx-ramblers.org.uk",
      "ngx-ramblers.org.uk",
      ["bolton.ngx-ramblers.org.uk", "kent.ngx-ramblers.org.uk", "new-forest.ngx-ramblers.org.uk"],
      ["bolton.ngx-ramblers.org.uk", "kent.ngx-ramblers.org.uk"]
    )).toEqual([]);
  });

  it("keeps leftover records on a group's own domain and drops other environments' hosts", () => {
    expect(unmappedHostsToOffer(
      "newforestramblers.org.uk",
      "ngx-ramblers.org.uk",
      ["www.newforestramblers.org.uk", "legacy.newforestramblers.org.uk", "kent.ngx-ramblers.org.uk"],
      ["kent.ngx-ramblers.org.uk"]
    )).toEqual(["www.newforestramblers.org.uk", "legacy.newforestramblers.org.uk"]);
  });
});
