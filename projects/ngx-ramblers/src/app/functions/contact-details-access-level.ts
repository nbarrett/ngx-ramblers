import { AccessLevel } from "../models/member-resource.model";
import { Organisation } from "../models/system.model";

export enum ContactAccessField {
  NAME = "name",
  PHONE = "phone",
  CONTACT = "contact"
}

export type ContactAccessLevelFieldKeys = {
  name: keyof Organisation;
  phone: keyof Organisation;
  contact: keyof Organisation;
  legacyShared?: keyof Organisation;
  legacyPublic?: keyof Organisation;
};

export const WALK_CONTACT_ACCESS_LEVEL_FIELDS: ContactAccessLevelFieldKeys = {
  name: "walkContactNameAccessLevel",
  phone: "walkContactPhoneAccessLevel",
  contact: "walkContactEmailAccessLevel",
  legacyShared: "walkContactDetailsAccessLevel",
  legacyPublic: "walkContactDetailsPublic"
};

export const SOCIAL_CONTACT_ACCESS_LEVEL_FIELDS: ContactAccessLevelFieldKeys = {
  name: "socialContactNameAccessLevel",
  phone: "socialContactPhoneAccessLevel",
  contact: "socialContactEmailAccessLevel",
  legacyShared: "socialDetailsAccessLevel",
  legacyPublic: "socialDetailsPublic"
};

export function contactDetailsAccessLevelFrom(accessLevel?: AccessLevel | null, legacyPublic?: boolean | null): AccessLevel {
  if (accessLevel) {
    return accessLevel;
  } else if (legacyPublic === false) {
    return AccessLevel.LOGGED_IN_MEMBER;
  } else {
    return AccessLevel.PUBLIC;
  }
}

export function resolveContactFieldAccessLevel(
  fieldLevel?: AccessLevel | null,
  sharedLevel?: AccessLevel | null,
  legacyPublic?: boolean | null
): AccessLevel {
  if (fieldLevel) {
    return fieldLevel;
  } else {
    return contactDetailsAccessLevelFrom(sharedLevel, legacyPublic);
  }
}

export function organisationContactFieldAccessLevel(
  organisation: Organisation | null | undefined,
  fields: ContactAccessLevelFieldKeys,
  field: ContactAccessField
): AccessLevel {
  const fieldKey = fields[field];
  return resolveContactFieldAccessLevel(
    organisation?.[fieldKey] as AccessLevel,
    fields.legacyShared ? organisation?.[fields.legacyShared] as AccessLevel : null,
    fields.legacyPublic ? organisation?.[fields.legacyPublic] as boolean : null
  );
}

export function migrateContactAccessLevels(
  organisation: Organisation | null | undefined,
  fields: ContactAccessLevelFieldKeys
) {
  if (organisation) {
    const legacyPublic = fields.legacyPublic ? organisation[fields.legacyPublic] as boolean : null;
    const shared = contactDetailsAccessLevelFrom(
      fields.legacyShared ? organisation[fields.legacyShared] as AccessLevel : null,
      legacyPublic
    );
    organisation[fields.name] = resolveContactFieldAccessLevel(
      organisation[fields.name] as AccessLevel,
      shared,
      legacyPublic
    ) as never;
    organisation[fields.phone] = resolveContactFieldAccessLevel(
      organisation[fields.phone] as AccessLevel,
      shared,
      legacyPublic
    ) as never;
    organisation[fields.contact] = resolveContactFieldAccessLevel(
      organisation[fields.contact] as AccessLevel,
      shared,
      legacyPublic
    ) as never;
    if (fields.legacyShared) {
      organisation[fields.legacyShared] = shared as never;
    }
  }
}

export function migrateAllContactAccessLevels(organisation?: Organisation) {
  migrateContactAccessLevels(organisation, WALK_CONTACT_ACCESS_LEVEL_FIELDS);
  migrateContactAccessLevels(organisation, SOCIAL_CONTACT_ACCESS_LEVEL_FIELDS);
}
