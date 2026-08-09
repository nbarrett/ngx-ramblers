import { describe, expect, it } from "vitest";
import { AccessLevel } from "../models/member-resource.model";
import {
  ContactAccessField,
  contactDetailsAccessLevelFrom,
  migrateAllContactAccessLevels,
  migrateContactAccessLevels,
  organisationContactFieldAccessLevel,
  resolveContactFieldAccessLevel,
  SOCIAL_CONTACT_ACCESS_LEVEL_FIELDS,
  WALK_CONTACT_ACCESS_LEVEL_FIELDS
} from "./contact-details-access-level";
import { Organisation } from "../models/system.model";

describe("contactDetailsAccessLevelFrom", () => {
  it("prefers an explicit access level over the legacy public flag", () => {
    expect(contactDetailsAccessLevelFrom(AccessLevel.COMMITTEE, true)).toBe(AccessLevel.COMMITTEE);
    expect(contactDetailsAccessLevelFrom(AccessLevel.PUBLIC, false)).toBe(AccessLevel.PUBLIC);
  });

  it("maps legacy public true or missing to public", () => {
    expect(contactDetailsAccessLevelFrom(null, true)).toBe(AccessLevel.PUBLIC);
    expect(contactDetailsAccessLevelFrom(undefined, undefined)).toBe(AccessLevel.PUBLIC);
    expect(contactDetailsAccessLevelFrom(null, null)).toBe(AccessLevel.PUBLIC);
  });

  it("maps legacy public false to logged-in member", () => {
    expect(contactDetailsAccessLevelFrom(null, false)).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(contactDetailsAccessLevelFrom(undefined, false)).toBe(AccessLevel.LOGGED_IN_MEMBER);
  });
});

describe("resolveContactFieldAccessLevel", () => {
  it("prefers the field level, then shared level, then legacy public flag", () => {
    expect(resolveContactFieldAccessLevel(AccessLevel.COMMITTEE, AccessLevel.PUBLIC, false)).toBe(AccessLevel.COMMITTEE);
    expect(resolveContactFieldAccessLevel(null, AccessLevel.LOGGED_IN_MEMBER, true)).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(resolveContactFieldAccessLevel(null, null, false)).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(resolveContactFieldAccessLevel(null, null, true)).toBe(AccessLevel.PUBLIC);
  });
});

describe("migrateContactAccessLevels", () => {
  it("seeds walk name, phone and contact link from the legacy public flag", () => {
    const organisation = {walkContactDetailsPublic: false} as Organisation;
    migrateContactAccessLevels(organisation, WALK_CONTACT_ACCESS_LEVEL_FIELDS);
    expect(organisation.walkContactNameAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(organisation.walkContactPhoneAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(organisation.walkContactEmailAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
  });

  it("seeds social name, phone and contact link from the legacy public flag", () => {
    const organisation = {socialDetailsPublic: false} as Organisation;
    migrateContactAccessLevels(organisation, SOCIAL_CONTACT_ACCESS_LEVEL_FIELDS);
    expect(organisation.socialContactNameAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(organisation.socialContactPhoneAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(organisation.socialContactEmailAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
  });

  it("keeps distinct field levels when already set", () => {
    const organisation = {
      walkContactDetailsPublic: false,
      walkContactNameAccessLevel: AccessLevel.PUBLIC,
      walkContactPhoneAccessLevel: AccessLevel.COMMITTEE,
      walkContactEmailAccessLevel: AccessLevel.HIDDEN
    } as Organisation;
    migrateContactAccessLevels(organisation, WALK_CONTACT_ACCESS_LEVEL_FIELDS);
    expect(organisation.walkContactNameAccessLevel).toBe(AccessLevel.PUBLIC);
    expect(organisation.walkContactPhoneAccessLevel).toBe(AccessLevel.COMMITTEE);
    expect(organisation.walkContactEmailAccessLevel).toBe(AccessLevel.HIDDEN);
  });

  it("maps contact field key to the stored email access level property", () => {
    const organisation = {
      walkContactEmailAccessLevel: AccessLevel.COMMITTEE
    } as Organisation;
    expect(organisationContactFieldAccessLevel(organisation, WALK_CONTACT_ACCESS_LEVEL_FIELDS, ContactAccessField.CONTACT))
      .toBe(AccessLevel.COMMITTEE);
  });

  it("migrates walk and social together", () => {
    const organisation = {
      walkContactDetailsPublic: false,
      socialDetailsPublic: true
    } as Organisation;
    migrateAllContactAccessLevels(organisation);
    expect(organisation.walkContactNameAccessLevel).toBe(AccessLevel.LOGGED_IN_MEMBER);
    expect(organisation.socialContactNameAccessLevel).toBe(AccessLevel.PUBLIC);
  });
});

describe("organisationContactFieldAccessLevel", () => {
  it("reads walk and social fields independently", () => {
    const organisation = {
      walkContactNameAccessLevel: AccessLevel.PUBLIC,
      socialContactNameAccessLevel: AccessLevel.COMMITTEE
    } as Organisation;
    expect(organisationContactFieldAccessLevel(organisation, WALK_CONTACT_ACCESS_LEVEL_FIELDS, ContactAccessField.NAME)).toBe(AccessLevel.PUBLIC);
    expect(organisationContactFieldAccessLevel(organisation, SOCIAL_CONTACT_ACCESS_LEVEL_FIELDS, ContactAccessField.NAME)).toBe(AccessLevel.COMMITTEE);
  });
});
