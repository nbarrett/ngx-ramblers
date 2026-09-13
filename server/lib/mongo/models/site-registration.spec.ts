import expect from "expect";
import { describe, it } from "mocha";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { siteRegistration, siteRegistrationConfig } from "./site-registration";

describe("site registration schemas", () => {
  it("keeps every registration setting including disabled committee email validation", () => {
    const settings = new siteRegistrationConfig({
      key: ConfigKey.SITE_REGISTRATION,
      value: {
        enabled: true,
        committeeEmailValidationEnabled: false,
        publicUrl: "https://platform.example.org",
        senderEmail: "sender@example.org",
        reviewer: {firstName: "Review", lastName: "Admin", email: "reviewer@example.org"},
        sourceEnvironmentName: "source",
        approvedEmails: [{groupCode: "AB01", emails: ["committee@example.org"]}]
      }
    }).toObject();
    expect(settings.value).toEqual({
      enabled: true,
      committeeEmailValidationEnabled: false,
      publicUrl: "https://platform.example.org",
      senderEmail: "sender@example.org",
      reviewer: {firstName: "Review", lastName: "Admin", email: "reviewer@example.org"},
      sourceEnvironmentName: "source",
      approvedEmails: [{groupCode: "AB01", emails: ["committee@example.org"]}]
    });
  });

  it("defines every stored registration attribute", () => {
    const requiredPaths = [
      "id", "group", "email", "plan", "currentStep", "website", "pages", "proposedNavigation", "state", "verifiedAt",
      "createdAt", "updatedAt", "environmentName", "siteUrl", "flavour", "progress", "error", "resumeTokenHash",
      "verificationTokenHash", "verificationExpiresAt", "lastEmailAt", "migrationConfig", "provisionedAt", "importedAt",
      "reviewedAt", "reviewNotifiedAt", "invitedAt", "leaseUntil", "leaseOwner"
    ];
    expect(requiredPaths.filter(path => !siteRegistration.schema.path(path))).toEqual([]);
  });
});
