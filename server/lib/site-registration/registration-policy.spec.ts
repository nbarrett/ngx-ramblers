import expect from "expect";
import { describe, it } from "mocha";
import { RegistrationSettings, RegistrationState, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { SetupStepStatus } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { normalisedRegistrationPublicUrl, registrationEnableProblems } from "../../../projects/ngx-ramblers/src/app/functions/registration-settings";
import {
  normalisedRegistrationEmail, publicRegistration, PUBLIC_REGISTRATION_FAILURE_MESSAGE, PUBLIC_REGISTRATION_RETURNED_MESSAGE,
  PUBLIC_REGISTRATION_STEP_FAILURE_MESSAGE, registrationEmailAllowed, registrationSettingsProblem, registrationToken, registrationTokenHash,
  reviewerRegistration, validRegistrationSettings
} from "./registration-policy";
import { publicSiteUrl } from "./public-site-fetch";

const settings: RegistrationSettings = {
  enabled: true,
  committeeEmailValidationEnabled: true,
  sourceFidelityValidationEnabled: true,
  publicUrl: "https://www.ngx-ramblers.org.uk",
  senderEmail: "sender@example.com",
  reviewer: {firstName: "Site", lastName: "Reviewer", email: "reviewer@example.com"},
  sourceEnvironmentName: "staging",
  approvedEmails: [{groupCode: "AB01", emails: ["committee@example.com"]}]
};

describe("site registration policy", () => {
  it("normalises and matches an approved committee email within its group", () => {
    expect(normalisedRegistrationEmail(" Committee@Example.com ")).toBe("committee@example.com");
    expect(registrationEmailAllowed(settings, " ab01 ", " Committee@Example.com ")).toBe(true);
    expect(registrationEmailAllowed(settings, "CD02", "committee@example.com")).toBe(false);
  });

  it("can turn off the approved-list match and save that choice on its own", () => {
    expect(registrationEmailAllowed({...settings, committeeEmailValidationEnabled: false}, "AB01", "tester@example.com")).toBe(true);
    expect(registrationEmailAllowed({...settings, committeeEmailValidationEnabled: false}, "AB01", "not-an-email")).toBe(false);
  });

  it("allows disabled settings and the validation toggle to be saved before setup is complete", () => {
    expect(validRegistrationSettings({
      enabled: false,
      committeeEmailValidationEnabled: false,
      sourceFidelityValidationEnabled: false,
      publicUrl: "",
      senderEmail: "",
      reviewer: {firstName: "", lastName: "", email: ""},
      sourceEnvironmentName: "",
      approvedEmails: []
    })).toBe(true);
  });

  it("requires complete settings before public registration is enabled", () => {
    expect(validRegistrationSettings({...settings, enabled: true})).toBe(true);
    expect(validRegistrationSettings({...settings, enabled: true, publicUrl: ""})).toBe(false);
  });

  it("creates opaque one-way resume and confirmation tokens", () => {
    const token = registrationToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(registrationTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(registrationTokenHash(token)).not.toBe(token);
  });

  it("shows the return-link holder a generic failure and keeps the detail for the reviewer", () => {
    const failed = {
      id: "registration-1", state: RegistrationState.FAILED, error: "Fly deploy failed: machine 1234 in lhr could not start (MongoServerError: bad auth)",
      progress: [
        {step: "Provision", status: SetupStepStatus.Completed, message: "Creating the review site", timestamp: 1},
        {step: "Provision", status: SetupStepStatus.Failed, message: "AWS: AccessDenied for bucket ngx-ramblers-example", timestamp: 2},
        {step: "Import", status: SetupStepStatus.Running, message: "Error scraping /walks: net::ERR_NAME_NOT_RESOLVED", timestamp: 3}
      ]
    } as StoredSiteRegistration;
    const shown = publicRegistration(failed);
    expect(shown.error).toBe(PUBLIC_REGISTRATION_FAILURE_MESSAGE);
    expect(shown.progress.map(entry => entry.message)).toEqual(["Creating the review site", PUBLIC_REGISTRATION_STEP_FAILURE_MESSAGE, PUBLIC_REGISTRATION_STEP_FAILURE_MESSAGE]);
    expect(shown.progress.map(entry => entry.status)).toEqual([SetupStepStatus.Completed, SetupStepStatus.Failed, SetupStepStatus.Failed]);
    expect(publicRegistration({...failed, state: RegistrationState.BROKEN, error: "Returned by the platform reviewer."}).error).toBe(PUBLIC_REGISTRATION_RETURNED_MESSAGE);
    expect(publicRegistration({...failed, error: null}).error).toBe(null);
    const reviewed = reviewerRegistration(failed);
    expect(reviewed.error).toBe(failed.error);
    expect(reviewed.progress).toEqual(failed.progress);
  });

  it("accepts only public HTTP website URL shapes before DNS resolution", () => {
    expect(publicSiteUrl("https://example.com/current-site").href).toBe("https://example.com/current-site");
    expect(() => publicSiteUrl("file:///etc/passwd")).toThrow("public HTTP or HTTPS");
    expect(() => publicSiteUrl("http://127.0.0.1/private")).toThrow("public HTTP or HTTPS");
    expect(() => publicSiteUrl("https://user:secret@example.com")).toThrow("public HTTP or HTTPS");
    expect(() => publicSiteUrl("https://example.com:8443")).toThrow("public HTTP or HTTPS");
  });
});

describe("registration settings problems", () => {
  const complete: RegistrationSettings = {
    enabled: true,
    committeeEmailValidationEnabled: true,
    sourceFidelityValidationEnabled: true,
    publicUrl: "https://www.ngx-ramblers.org.uk",
    senderEmail: "registrations@ngx-ramblers.org.uk",
    sourceEnvironmentName: "staging",
    reviewer: {firstName: "Nick", lastName: "Barrett", email: "nick@ngx-ramblers.org.uk"},
    approvedEmails: []
  };

  it("names the public registration website when it is not a https origin", () => {
    expect(registrationSettingsProblem({...complete, publicUrl: ""})).toContain("Public registration website");
    expect(registrationSettingsProblem({...complete, publicUrl: "http://www.ngx-ramblers.org.uk"})).toContain("Public registration website");
  });

  it("keeps only the https origin when a registration path is included", () => {
    expect(registrationSettingsProblem({...complete, publicUrl: "https://www.ngx-ramblers.org.uk/register"})).toEqual("");
  });

  it("names the setup template, sender, reviewer name and reviewer email in turn", () => {
    expect(registrationSettingsProblem({...complete, sourceEnvironmentName: " "})).toContain("NGX setup template");
    expect(registrationSettingsProblem({...complete, senderEmail: "not-an-email"})).toContain("Email address used to send messages");
    expect(registrationSettingsProblem({...complete, reviewer: {...complete.reviewer, lastName: " "}})).toContain("reviewer's first name and last name");
    expect(registrationSettingsProblem({...complete, reviewer: {...complete.reviewer, email: "nope"}})).toContain("Reviewer's email");
  });

  it("accepts incomplete settings while registration is switched off", () => {
    expect(registrationSettingsProblem({...complete, enabled: false, publicUrl: "", senderEmail: "", sourceEnvironmentName: "", reviewer: {firstName: "", lastName: "", email: ""}})).toEqual("");
  });

  it("names the group whose approved email list is invalid, whether or not registration is on", () => {
    const withBadEmail = {...complete, enabled: false, approvedEmails: [{groupCode: "AB01", emails: ["fine@example.com"]}, {groupCode: "CD02", emails: ["broken"]}]};
    expect(registrationSettingsProblem(withBadEmail)).toContain("CD02");
  });

  it("reports nothing to fix when the settings are complete", () => {
    expect(registrationSettingsProblem(complete)).toEqual("");
  });

  it("strips a path from the public registration website", () => {
    expect(normalisedRegistrationPublicUrl("https://www.ngx-ramblers.org.uk/register")).toBe("https://www.ngx-ramblers.org.uk");
    expect(normalisedRegistrationPublicUrl("https://www.ngx-ramblers.org.uk/")).toBe("https://www.ngx-ramblers.org.uk");
  });

  it("lists every missing enable field at once", () => {
    expect(registrationEnableProblems({...complete, publicUrl: "", sourceEnvironmentName: "", senderEmail: "", reviewer: {firstName: "", lastName: "", email: ""}})).toEqual([
      "Public registration website must be the https address of this site and nothing more, such as https://www.ngx-ramblers.org.uk.",
      "Choose an NGX setup template.",
      "Email address used to send messages must be a valid email address.",
      "Enter the reviewer's first name and last name.",
      "Reviewer's email must be a valid email address."
    ]);
  });
});
