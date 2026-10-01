import {describe, expect, it, vi} from "vitest";
import {RecipientFieldComponent} from "./recipient-field";
import {ComposerExternalRecipient} from "../../../models/email-composer.model";

describe("recipient chip identity", () => {
  it("keeps member qualification when a role address replaces their personal address", () => {
    const member = {id: "member-one", email: "alex@example.com"};
    const instance = Object.create(RecipientFieldComponent.prototype);
    Object.assign(instance, {
      qualifierByEmail: new Map(),
      memberById: new Map([[member.id, member]]),
      memberByEmail: new Map([[member.email, member]]),
      committeeAddresses: [],
      expandableSet: () => false,
      qualifierForMember: vi.fn(() => "with Head Office consent")
    });
    const recipient: ComposerExternalRecipient = {email: "chair@group.example.org.uk", memberId: member.id, name: "Alex Reed", saveForReuse: false};
    expect(instance.chipQualifier(recipient)).toBe("with Head Office consent");
    expect(instance.qualifierForMember).toHaveBeenCalledWith(member);
    expect(instance.chipQualifier({...recipient, memberId: null})).toBe("external");
  });
});
