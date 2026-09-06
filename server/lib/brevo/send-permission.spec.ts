import expect from "expect";
import { describe, it } from "mocha";
import { channelFor, sendDecision } from "./send-permission";
import {
  MailConfig,
  PlatformSendControl,
  SendChannel,
  SendPurpose,
  SendRefusalReason
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { values } from "es-toolkit/compat";

describe("send permission", () => {
  const everythingOn = {allowSendTransactional: true, allowSendCampaign: true, allowSystemEmailsWhenTransactionalOff: true} as MailConfig;
  const transactionalOff = {...everythingOn, allowSendTransactional: false} as MailConfig;
  const campaignOff = {...everythingOn, allowSendCampaign: false} as MailConfig;
  const suspended: PlatformSendControl = {sendingSuspended: true, reason: "Head office request"};
  const allPurposes: SendPurpose[] = values(SendPurpose);
  const transactionalPurposes = allPurposes.filter(purpose => channelFor(purpose) === SendChannel.TRANSACTIONAL);
  const campaignPurposes = allPurposes.filter(purpose => channelFor(purpose) === SendChannel.CAMPAIGN);
  const systemPurposes = [SendPurpose.PASSWORD_RESET, SendPurpose.ADMIN_ALERT];
  const ordinaryTransactionalPurposes = transactionalPurposes.filter(purpose => !systemPurposes.includes(purpose));

  it("classifies campaign send and release as the campaign channel and everything else as transactional", () => {
    expect(campaignPurposes.sort()).toEqual([SendPurpose.CAMPAIGN_RELEASE, SendPurpose.CAMPAIGN_SEND].sort());
    expect(transactionalPurposes.length).toEqual(allPurposes.length - 2);
  });

  it("allows every purpose when both flags are on and the platform has not suspended sending", () => {
    allPurposes.forEach(purpose => expect(sendDecision(everythingOn, null, purpose).allowed).toEqual(true));
    allPurposes.forEach(purpose => expect(sendDecision(everythingOn, {sendingSuspended: false}, purpose).allowed).toEqual(true));
  });

  it("allows every purpose when no mail configuration exists yet", () => {
    allPurposes.forEach(purpose => expect(sendDecision(null, null, purpose).allowed).toEqual(true));
  });

  it("refuses every transactional send point except the system ones when Allow Send Transactional is off", () => {
    ordinaryTransactionalPurposes.forEach(purpose => {
      const decision = sendDecision(transactionalOff, null, purpose);
      expect(decision.allowed).toEqual(false);
      expect(decision.reason).toEqual(SendRefusalReason.TRANSACTIONAL_OFF);
      expect(decision.message).toContain("Allow Send Transactional is switched off");
    });
  });

  it("still sends password reset and admin alert emails when transactional is off and the system email setting is on", () => {
    systemPurposes.forEach(purpose => expect(sendDecision(transactionalOff, null, purpose).allowed).toEqual(true));
  });

  it("refuses password reset and admin alert emails when transactional is off and the system email setting is off", () => {
    const systemOff = {...transactionalOff, allowSystemEmailsWhenTransactionalOff: false} as MailConfig;
    systemPurposes.forEach(purpose => {
      const decision = sendDecision(systemOff, null, purpose);
      expect(decision.allowed).toEqual(false);
      expect(decision.reason).toEqual(SendRefusalReason.TRANSACTIONAL_OFF);
    });
  });

  it("treats a missing system email setting as on", () => {
    const unset = {allowSendTransactional: false, allowSendCampaign: true} as MailConfig;
    systemPurposes.forEach(purpose => expect(sendDecision(unset, null, purpose).allowed).toEqual(true));
  });

  it("leaves campaign sends alone when only transactional is off", () => {
    campaignPurposes.forEach(purpose => expect(sendDecision(transactionalOff, null, purpose).allowed).toEqual(true));
  });

  it("refuses campaign send and release when Allow Send Campaign is off, and nothing else", () => {
    campaignPurposes.forEach(purpose => {
      const decision = sendDecision(campaignOff, null, purpose);
      expect(decision.allowed).toEqual(false);
      expect(decision.reason).toEqual(SendRefusalReason.CAMPAIGN_OFF);
      expect(decision.message).toContain("Allow Send Campaign is switched off");
    });
    transactionalPurposes.forEach(purpose => expect(sendDecision(campaignOff, null, purpose).allowed).toEqual(true));
  });

  it("refuses every purpose, including password reset and admin alerts, when the platform has suspended sending", () => {
    allPurposes.forEach(purpose => {
      const decision = sendDecision(everythingOn, suspended, purpose);
      expect(decision.allowed).toEqual(false);
      expect(decision.reason).toEqual(SendRefusalReason.PLATFORM_SUSPENDED);
      expect(decision.message).toContain("suspended by the platform administrator (Head office request)");
    });
  });

  it("platform suspension wins over the site's own settings", () => {
    expect(sendDecision(transactionalOff, suspended, SendPurpose.PASSWORD_RESET).reason).toEqual(SendRefusalReason.PLATFORM_SUSPENDED);
    expect(sendDecision(campaignOff, suspended, SendPurpose.CAMPAIGN_SEND).reason).toEqual(SendRefusalReason.PLATFORM_SUSPENDED);
  });
});
