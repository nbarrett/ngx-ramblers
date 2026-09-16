import expect from "expect";
import { describe, it } from "mocha";
import { BrandingMode } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  compositionSenderEmail,
  holdsMailboxAccountAddress,
  replacementSender,
  senderOutsideMailboxAccounts
} from "./inbox-composition-sender";

describe("composition sender email", () => {

  describe("prefers the address matching the composition's own branding mode, then the other mode's, then the owner's, then the alias, and never the mailbox account", () => {

    it("uses the unbranded sender when the composition was sent unbranded", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "secretary@ekwg.co.uk",
        brandedSenderEmail: "noreply@ekwg.co.uk",
        ownerEmail: "chair@ekwg.co.uk",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("secretary@ekwg.co.uk");
    });

    it("uses the branded sender when the composition was sent branded", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.BRANDED,
        unbrandedSenderEmail: "secretary@ekwg.co.uk",
        brandedSenderEmail: "noreply@ekwg.co.uk",
        ownerEmail: "chair@ekwg.co.uk",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("noreply@ekwg.co.uk");
    });

    it("treats a composition with no branding mode as branded", () => {
      expect(compositionSenderEmail({
        unbrandedSenderEmail: "secretary@ekwg.co.uk",
        brandedSenderEmail: "noreply@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("noreply@ekwg.co.uk");
    });

    it("falls through to the other mode's address when the own mode's address is the mailbox account", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        brandedSenderEmail: "noreply@ekwg.co.uk",
        ownerEmail: "chair@ekwg.co.uk",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("noreply@ekwg.co.uk");
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.BRANDED,
        unbrandedSenderEmail: "secretary@ekwg.co.uk",
        brandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        ownerEmail: "chair@ekwg.co.uk",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("secretary@ekwg.co.uk");
    });

    it("falls through to the owner when neither mode has a usable address, then to the alias", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        ownerEmail: "chair@ekwg.co.uk",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("chair@ekwg.co.uk");
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        aliasEmail: "membership@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("membership@ekwg.co.uk");
    });

    it("never uses the mailbox account address, even when every candidate is the mailbox account", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        brandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        ownerEmail: "eastkentwalkinggroup@gmail.com",
        aliasEmail: "eastkentwalkinggroup@gmail.com",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("");
    });

    it("ignores casing when comparing with the mailbox account", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "EastKentWalkingGroup@Gmail.com",
        ownerEmail: "nick.barrett@ekwg.co.uk",
        mailboxAccountEmail: "eastkentwalkinggroup@gmail.com"
      })).toEqual("nick.barrett@ekwg.co.uk");
    });

    it("uses the first candidate when no mailbox account is known", () => {
      expect(compositionSenderEmail({
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com",
        brandedSenderEmail: "noreply@ekwg.co.uk"
      })).toEqual("eastkentwalkinggroup@gmail.com");
    });

  });

});

describe("replacing mailbox account senders", () => {

  const accountEmails = new Set(["eastkentwalkinggroup@gmail.com", "canterburyramblers@gmail.com"]);

  describe("holdsMailboxAccountAddress", () => {

    it("recognises any connected account address regardless of casing", () => {
      expect(holdsMailboxAccountAddress({name: "EKWG", email: "EastKentWalkingGroup@gmail.com"}, accountEmails)).toBe(true);
      expect(holdsMailboxAccountAddress({name: null, email: "canterburyramblers@gmail.com"}, accountEmails)).toBe(true);
    });

    it("is false for another address, an empty address or no address", () => {
      expect(holdsMailboxAccountAddress({name: "Nick", email: "nick.barrett@ekwg.co.uk"}, accountEmails)).toBe(false);
      expect(holdsMailboxAccountAddress({name: "Nick", email: ""}, accountEmails)).toBe(false);
      expect(holdsMailboxAccountAddress(null, accountEmails)).toBe(false);
      expect(holdsMailboxAccountAddress(undefined, accountEmails)).toBe(false);
    });

  });

  describe("senderOutsideMailboxAccounts", () => {

    it("returns the address when it is not a mailbox account", () => {
      const sender = {name: "Nick", email: "nick.barrett@ekwg.co.uk"};
      expect(senderOutsideMailboxAccounts(sender, accountEmails)).toBe(sender);
    });

    it("returns null for a mailbox account address, an empty address or no address", () => {
      expect(senderOutsideMailboxAccounts({name: "EKWG", email: "EASTKENTWALKINGGROUP@GMAIL.COM"}, accountEmails)).toBeNull();
      expect(senderOutsideMailboxAccounts({name: "EKWG", email: ""}, accountEmails)).toBeNull();
      expect(senderOutsideMailboxAccounts(null, accountEmails)).toBeNull();
    });

  });

  describe("replacementSender", () => {

    const owner = {email: "chair@ekwg.co.uk", firstName: "Nick", lastName: "Barrett"};

    it("keeps the message's sender name and takes the composition's own-mode address", () => {
      expect(replacementSender(
        {name: "East Kent Walking Group", email: "eastkentwalkinggroup@gmail.com"},
        {brandingMode: BrandingMode.UNBRANDED, unbrandedSenderEmail: "secretary@ekwg.co.uk", brandedSenderEmail: "noreply@ekwg.co.uk"},
        owner
      )).toEqual({name: "East Kent Walking Group", email: "secretary@ekwg.co.uk"});
    });

    it("names the sender after the owner when the message had no sender name", () => {
      expect(replacementSender(
        {name: "", email: "eastkentwalkinggroup@gmail.com"},
        {brandingMode: BrandingMode.UNBRANDED, unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com", brandedSenderEmail: null},
        owner
      )).toEqual({name: "Nick Barrett", email: "chair@ekwg.co.uk"});
    });

    it("leaves the sender name empty when neither the message nor an owner supplies one", () => {
      expect(replacementSender(
        {name: null, email: "eastkentwalkinggroup@gmail.com"},
        {brandingMode: BrandingMode.BRANDED, unbrandedSenderEmail: null, brandedSenderEmail: "noreply@ekwg.co.uk"},
        null
      )).toEqual({name: "", email: "noreply@ekwg.co.uk"});
    });

    it("returns null when no address other than the mailbox account is known", () => {
      expect(replacementSender(
        {name: "EKWG", email: "eastkentwalkinggroup@gmail.com"},
        {brandingMode: BrandingMode.UNBRANDED, unbrandedSenderEmail: "eastkentwalkinggroup@gmail.com", brandedSenderEmail: null},
        {email: "EastKentWalkingGroup@gmail.com", firstName: "Nick", lastName: "Barrett"}
      )).toBeNull();
      expect(replacementSender({name: "EKWG", email: "eastkentwalkinggroup@gmail.com"}, null, null)).toBeNull();
    });

  });

});
