import { CommitteeMember, ForwardEmailTarget, RoleType } from "../models/committee.model";
import { SendSmtpEmailParams } from "../models/mail.model";
import {
  contactUsDeliveryProblem,
  effectiveContactUsTarget,
  resolveContactUsRecipientAddresses,
  withContactUsRecipientMergeFields
} from "./contact-us-delivery";

function role(partial: Partial<CommitteeMember>): CommitteeMember {
  return {
    type: "contact-us",
    description: "Contact Us",
    fullName: "Contact Us",
    email: "contact-us@example.org",
    roleType: RoleType.SYSTEM_ROLE,
    vacant: false,
    ...partial
  } as CommitteeMember;
}

describe("contact-us-delivery", () => {
  it("prefers contactUsTarget over forwardEmailTarget", () => {
    expect(effectiveContactUsTarget(role({
      contactUsTarget: ForwardEmailTarget.MULTIPLE,
      forwardEmailTarget: ForwardEmailTarget.CATCHALL
    }))).toBe(ForwardEmailTarget.MULTIPLE);
  });

  it("allows catch-all even when provisional To matches the sender address", () => {
    const problem = contactUsDeliveryProblem(
      role({forwardEmailTarget: ForwardEmailTarget.CATCHALL}),
      "contact-us@example.org"
    );
    expect(problem).toBeNull();
  });

  it("allows catch-all when catch-all email expands away from the sender", () => {
    const member = role({contactUsTarget: ForwardEmailTarget.CATCHALL});
    const to = resolveContactUsRecipientAddresses(member, {catchAllEmail: "inbox@example.org"});
    expect(to.map(address => address.email)).toEqual(["inbox@example.org"]);
    expect(contactUsDeliveryProblem(member, "contact-us@example.org", {catchAllEmail: "inbox@example.org"})).toBeNull();
  });

  it("allows role-email even when From and To are the same address", () => {
    const problem = contactUsDeliveryProblem(
      role({contactUsTarget: ForwardEmailTarget.ROLE_EMAIL}),
      "contact-us@example.org"
    );
    expect(problem).toBeNull();
  });

  it("allows multiple recipients that differ from the sender", () => {
    const problem = contactUsDeliveryProblem(
      role({
        contactUsTarget: ForwardEmailTarget.MULTIPLE,
        contactUsRecipients: ["chair@example.org", "membership@example.org"]
      }),
      "contact-us@example.org"
    );
    expect(problem).toBeNull();
  });

  it("blocks when contact-us is disabled", () => {
    const problem = contactUsDeliveryProblem(
      role({contactUsTarget: ForwardEmailTarget.NONE}),
      "contact-us@example.org"
    );
    expect(problem).toContain("disabled");
  });

  it("blocks when no recipient can be resolved", () => {
    const problem = contactUsDeliveryProblem(
      role({email: "", contactUsTarget: ForwardEmailTarget.ROLE_EMAIL}),
      "contact-us@example.org"
    );
    expect(problem).toContain("No contact recipient");
  });

  it("allows a non-sender role emailed at its own address", () => {
    const problem = contactUsDeliveryProblem(
      role({
        type: "treasurer",
        email: "treasurer@example.org",
        fullName: "Michael",
        contactUsTarget: ForwardEmailTarget.ROLE_EMAIL
      }),
      "contact-us@example.org"
    );
    expect(problem).toBeNull();
  });

  it("greets the committee recipient rather than the visitor on the inbound copy", () => {
    const params = visitorParams();
    const updated = withContactUsRecipientMergeFields(params, [
      {name: "Pat Taylor", email: "chair@group.example.org.uk"}
    ]);
    expect(updated.memberMergeFields.FNAME).toBe("Pat");
    expect(updated.memberMergeFields.LNAME).toBe("Taylor");
    expect(updated.memberMergeFields.FULL_NAME).toBe("Pat Taylor");
    expect(updated.memberMergeFields.EMAIL).toBe("chair@group.example.org.uk");
    expect(params.memberMergeFields.FNAME).toBe("Alex");
  });

  it("keeps the visitor greeting when the copy is sent to the visitor", () => {
    const updated = withContactUsRecipientMergeFields(visitorParams(), [
      {name: "Alex Reed", email: "alex.reed@example.com"}
    ]);
    expect(updated.memberMergeFields.FNAME).toBe("Alex");
    expect(updated.memberMergeFields.EMAIL).toBe("alex.reed@example.com");
  });

  it("leaves merge fields unchanged when there is no recipient", () => {
    const params = visitorParams();
    const updated = withContactUsRecipientMergeFields(params, []);
    expect(updated).toBe(params);
  });
});

function visitorParams(): SendSmtpEmailParams {
  return {
    messageMergeFields: {
      subject: "Website Enquiry",
      BANNER_IMAGE_SOURCE: "",
      ADDRESS_LINE: "Hi {{params.memberMergeFields.FNAME}},"
    },
    memberMergeFields: {
      FULL_NAME: "Alex Reed",
      EMAIL: "alex.reed@example.com",
      FNAME: "Alex",
      LNAME: "Reed",
      MEMBER_NUM: "",
      MEMBER_EXP: "",
      USERNAME: "",
      PW_RESET: ""
    },
    systemMergeFields: {
      APP_URL: "https://group.example.org.uk",
      APP_SHORTNAME: "Hillside",
      APP_LONGNAME: "Hillside Park Ramblers",
      PW_RESET_LINK: "",
      FACEBOOK_URL: "",
      TWITTER_URL: "",
      INSTAGRAM_URL: ""
    },
    accountMergeFields: {
      STREET: "",
      POSTCODE: "",
      TOWN: "",
      REGISTERED_OFFICE: ""
    }
  };
}
