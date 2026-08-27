import { describe, expect, it } from "vitest";
import { RecipientAddressMode } from "../models/email-composer.model";
import { syncedRecipientAddressMode } from "./email-composer";

describe("syncedRecipientAddressMode", () => {

  it("uses personal addresses when the send is not a committee-only list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: false,
      preselectCommitteeRole: true,
      current: RecipientAddressMode.COMMITTEE_ROLE
    })).toEqual(RecipientAddressMode.PERSONAL);
  });

  it("preselects committee role addresses for a committee list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: true,
      current: RecipientAddressMode.PERSONAL
    })).toEqual(RecipientAddressMode.COMMITTEE_ROLE);
  });

  it("keeps a manual personal choice on a committee list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: false,
      current: RecipientAddressMode.PERSONAL
    })).toEqual(RecipientAddressMode.PERSONAL);
  });

  it("keeps a manual committee role choice on a committee list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: false,
      current: RecipientAddressMode.COMMITTEE_ROLE
    })).toEqual(RecipientAddressMode.COMMITTEE_ROLE);
  });
});
