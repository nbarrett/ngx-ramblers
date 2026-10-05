import expect from "expect";
import {describe, it} from "mocha";
import {resolveSenderAddresses} from "./batch-transactional-send";
import {BatchTransactionalSendRequest} from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import {BrandingMode, NotificationConfig} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {CommitteeMember} from "../../../../projects/ngx-ramblers/src/app/models/committee.model";

describe("batch composer reply-to selection", () => {
  const roles = [
    {type: "chair", email: "chair@group.example.org.uk", fullName: "Alex Reed"},
    {type: "membership", email: "membership@group.example.org.uk", fullName: "Sam Taylor"}
  ] as CommitteeMember[];
  const config = {senderRole: "chair", replyToRole: "membership"} as NotificationConfig;

  it("omits reply-to when the composer explicitly clears the email type default", () => {
    const request = {brandingMode: BrandingMode.BRANDED, replyToRoleOverride: ""} as BatchTransactionalSendRequest;
    expect(resolveSenderAddresses(request, roles, config, null)).toMatchObject({
      sender: {email: "chair@group.example.org.uk"},
      replyTo: null
    });
  });

  it("preserves the configured reply-to when no override was supplied", () => {
    const request = {brandingMode: BrandingMode.BRANDED} as BatchTransactionalSendRequest;
    expect(resolveSenderAddresses(request, roles, config, null)).toMatchObject({
      replyTo: {email: "membership@group.example.org.uk"}
    });
  });

  it("treats a whitespace-only override as Same as sender", () => {
    const request = {brandingMode: BrandingMode.BRANDED, replyToRoleOverride: " "} as BatchTransactionalSendRequest;
    expect(resolveSenderAddresses(request, roles, config, null)).toMatchObject({replyTo: null});
  });

  it("uses an explicitly selected reply-to role", () => {
    const request = {brandingMode: BrandingMode.BRANDED, replyToRoleOverride: "chair"} as BatchTransactionalSendRequest;
    expect(resolveSenderAddresses(request, roles, config, null)).toMatchObject({
      replyTo: {email: "chair@group.example.org.uk"}
    });
  });
});
