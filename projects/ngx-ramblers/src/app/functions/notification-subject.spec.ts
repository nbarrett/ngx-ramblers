import { describe, expect, it } from "vitest";
import { joinNotificationSubject, notificationSubjectAffixDelimiter } from "./notification-subject";

describe("notificationSubjectAffixDelimiter", () => {
  it("defaults to an en dash when the subject has no dash", () => {
    expect(notificationSubjectAffixDelimiter("Your login details")).toBe(" – ");
    expect(notificationSubjectAffixDelimiter(null)).toBe(" – ");
  });

  it("reuses an em dash already in the configured subject", () => {
    expect(notificationSubjectAffixDelimiter("Mobile Trial — Your login details")).toBe(" — ");
  });

  it("reuses an en dash already in the configured subject", () => {
    expect(notificationSubjectAffixDelimiter("Mobile Trial – Your login details")).toBe(" – ");
  });

  it("reuses a spaced hyphen already in the configured subject", () => {
    expect(notificationSubjectAffixDelimiter("Mobile Trial - Your login details")).toBe(" - ");
  });
});

describe("joinNotificationSubject", () => {
  it("joins prefix and name with an en dash when the subject has none", () => {
    expect(joinNotificationSubject(["NGX-Ramblers", "Your login details", "Alex Reed"]))
      .toBe("NGX-Ramblers – Your login details – Alex Reed");
  });

  it("joins with an em dash when the subject already uses one", () => {
    expect(joinNotificationSubject(["NGX-Ramblers", "Mobile Trial — Your login details", "Alex Reed"]))
      .toBe("NGX-Ramblers — Mobile Trial — Your login details — Alex Reed");
  });
});
