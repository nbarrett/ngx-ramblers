import expect from "expect";
import { describe, it } from "mocha";
import { nameserverLookupCandidates } from "./dns-nameservers";

describe("nameserverLookupCandidates", () => {

  it("walks from the hostname toward the registrable domain and skips public suffixes", () => {
    expect(nameserverLookupCandidates("staging.example.org.uk")).toEqual([
      "staging.example.org.uk",
      "example.org.uk"
    ]);
    expect(nameserverLookupCandidates("www.example.com")).toEqual([
      "www.example.com",
      "example.com"
    ]);
  });

  it("keeps a two-label apex such as example.com", () => {
    expect(nameserverLookupCandidates("example.com")).toEqual(["example.com"]);
  });
});
