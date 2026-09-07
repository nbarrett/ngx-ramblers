import expect from "expect";
import { describe, it } from "mocha";
import { maskedApiRequest, maskSecretQueryParameters } from "./mask-secrets";

describe("maskSecretQueryParameters", () => {

  it("masks an access token wherever it sits in the query", () => {
    expect(maskSecretQueryParameters("https://graph.facebook.com/v21.0/123?fields=id&access_token=EAANabc123"))
      .toEqual("https://graph.facebook.com/v21.0/123?fields=id&access_token=***");
    expect(maskSecretQueryParameters("/me/accounts?access_token=EAANabc123&fields=name"))
      .toEqual("/me/accounts?access_token=***&fields=name");
  });

  it("masks every secret-looking parameter and leaves the rest alone", () => {
    expect(maskSecretQueryParameters("/oauth/access_token?client_id=1&client_secret=shh&fb_exchange_token=tok&input_token=in&redirect_uri=x"))
      .toEqual("/oauth/access_token?client_id=1&client_secret=***&fb_exchange_token=***&input_token=***&redirect_uri=x");
  });

  it("returns text without secrets unchanged", () => {
    expect(maskSecretQueryParameters("/walks?limit=10")).toEqual("/walks?limit=10");
    expect(maskSecretQueryParameters("")).toEqual("");
    expect(maskSecretQueryParameters(null)).toEqual(null);
  });
});

describe("maskedApiRequest", () => {

  it("returns a copy with the path masked and everything else intact", () => {
    const apiRequest = {hostname: "graph.facebook.com", method: "get", path: "/v21.0/1?access_token=EAAN1"};
    expect(maskedApiRequest(apiRequest)).toEqual({hostname: "graph.facebook.com", method: "get", path: "/v21.0/1?access_token=***"});
    expect(apiRequest.path).toEqual("/v21.0/1?access_token=EAAN1");
  });

  it("passes through a request with no path", () => {
    expect(maskedApiRequest({hostname: "example.org"})).toEqual({hostname: "example.org"});
    expect(maskedApiRequest(null as Record<string, any>)).toEqual(null);
  });
});
