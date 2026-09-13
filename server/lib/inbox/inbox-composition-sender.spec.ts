import expect from "expect";
import { describe, it } from "mocha";
import { BrandingMode } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { compositionSenderEmail } from "./inbox-composition-sender";

describe("composition sender email", () => {

  it("never uses the mailbox account address, even when the composition asked for it", () => {
    expect(compositionSenderEmail({
      brandingMode: BrandingMode.UNBRANDED,
      unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
      brandedSenderEmail: "nick.barrett@ekwg.co.uk",
      ownerEmail: "nick.barrett@ekwg.co.uk",
      aliasEmail: "eastkentwalkinggroup@gmail.com",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("nick.barrett@ekwg.co.uk");
  });

  it("uses the unbranded sender when it is a domain address", () => {
    expect(compositionSenderEmail({
      brandingMode: BrandingMode.UNBRANDED,
      unbrandedSenderEmail: "secretary@ekwg.co.uk",
      brandedSenderEmail: "noreply@ekwg.co.uk",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("secretary@ekwg.co.uk");
  });

  it("uses the branded sender when the composition is branded", () => {
    expect(compositionSenderEmail({
      brandingMode: BrandingMode.BRANDED,
      unbrandedSenderEmail: "secretary@ekwg.co.uk",
      brandedSenderEmail: "noreply@ekwg.co.uk",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("noreply@ekwg.co.uk");
  });

  it("falls back to the owner and then the alias", () => {
    expect(compositionSenderEmail({
      ownerEmail: "chair@ekwg.co.uk",
      aliasEmail: "secretary@ekwg.co.uk",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("chair@ekwg.co.uk");
    expect(compositionSenderEmail({
      aliasEmail: "secretary@ekwg.co.uk",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("secretary@ekwg.co.uk");
  });

  it("ignores casing when comparing with the mailbox account", () => {
    expect(compositionSenderEmail({
      brandingMode: BrandingMode.UNBRANDED,
      unbrandedSenderEmail: "EastKentWalkingGroup@Gmail.com",
      ownerEmail: "nick.barrett@ekwg.co.uk",
      mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
    })).toEqual("nick.barrett@ekwg.co.uk");
  });

});
