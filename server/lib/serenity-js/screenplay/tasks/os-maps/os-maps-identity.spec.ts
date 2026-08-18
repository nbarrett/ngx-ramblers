import expect from "expect";
import { describe, it } from "mocha";
import { trimmedOsMapsLogin, uniqueOsMapsIdentityErrors } from "./os-maps-login-values";

describe("trimmedOsMapsLogin", () => {

  it("strips spaces around the email and password", () => {
    expect(trimmedOsMapsLogin("  walker@example.com  ", " secret ")).toEqual({
      email: "walker@example.com",
      password: "secret"
    });
  });

  it("treats missing values as empty strings", () => {
    expect(trimmedOsMapsLogin("", "")).toEqual({email: "", password: ""});
  });

});

describe("uniqueOsMapsIdentityErrors", () => {

  it("drops the repeated OS page-level copy", () => {
    expect(uniqueOsMapsIdentityErrors([
      "Wrong email or password. Please try again or contact Customer Services for help.",
      "Wrong email or password. Please try again or contact Customer Services for help."
    ])).toEqual("Wrong email or password. Please try again or contact Customer Services for help.");
  });

});
