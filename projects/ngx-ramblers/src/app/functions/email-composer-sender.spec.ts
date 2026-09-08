import { describe, expect, it } from "vitest";
import { ComposerSenderKind, ComposerSenderIdentity } from "../models/email-composer.model";
import { RamblersEventType } from "../models/ramblers-walks-manager";
import { Organisation } from "../models/system.model";
import { defaultBrandedSenderEmail } from "./email-composer";
import { notificationConfigIdFor } from "./event-type-notification-config";

function identity(partial: Partial<ComposerSenderIdentity> & Pick<ComposerSenderIdentity, "email" | "kind">): ComposerSenderIdentity {
  return {
    name: "Andrew Goh",
    label: partial.label ?? partial.email,
    roleType: partial.roleType ?? null,
    ...partial
  };
}

describe("defaultBrandedSenderEmail", () => {

  const contact = identity({
    kind: ComposerSenderKind.CONTACT,
    email: "andrew.goh4@googlemail.com",
    label: "Contact email <andrew.goh4@googlemail.com>"
  });
  const social = identity({
    kind: ComposerSenderKind.COMMITTEE_ROLE,
    email: "social@ekwg.co.uk",
    roleType: "social-co-ordinator",
    label: "Social Co-ordinator <social@ekwg.co.uk>"
  });

  it("uses the email type's role address rather than the contact email", () => {
    expect(defaultBrandedSenderEmail([contact, social], { preferredRoleType: "social-co-ordinator" }))
      .toEqual("social@ekwg.co.uk");
  });

  it("keeps an explicit Send from choice", () => {
    expect(defaultBrandedSenderEmail([contact, social], {
      chosenEmail: "andrew.goh4@googlemail.com",
      preferredRoleType: "social-co-ordinator"
    })).toEqual("andrew.goh4@googlemail.com");
  });

  it("falls back to the first committee address when the email type has no matching role", () => {
    expect(defaultBrandedSenderEmail([contact, social], { preferredRoleType: "chairman-website-design" }))
      .toEqual("social@ekwg.co.uk");
  });

  it("falls back to contact email when the member has no committee address", () => {
    expect(defaultBrandedSenderEmail([contact])).toEqual("andrew.goh4@googlemail.com");
  });
});

describe("notificationConfigIdFor", () => {

  const group = {
    groupWalkNotificationConfigId: "walk-config",
    groupEventNotificationConfigId: "social-config"
  } as Organisation;

  it("uses the social events email type configured for group events", () => {
    expect(notificationConfigIdFor(group, RamblersEventType.GROUP_EVENT)).toEqual("social-config");
  });

  it("uses the walk email type configured for group walks", () => {
    expect(notificationConfigIdFor(group, RamblersEventType.GROUP_WALK)).toEqual("walk-config");
  });

  it("treats an unknown event type as a group event", () => {
    expect(notificationConfigIdFor(group, null)).toEqual("social-config");
  });

  it("returns null when nothing is configured", () => {
    expect(notificationConfigIdFor({groupEventNotificationConfigId: " "} as Organisation, RamblersEventType.GROUP_EVENT)).toBeNull();
    expect(notificationConfigIdFor(null, RamblersEventType.GROUP_WALK)).toBeNull();
  });
});
