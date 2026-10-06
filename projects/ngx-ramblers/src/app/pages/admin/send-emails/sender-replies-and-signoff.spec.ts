import {SimpleChange} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {beforeEach, describe, expect, it} from "vitest";
import {SenderRepliesAndSignoff} from "./sender-replies-and-signoff";
import {MemberLoginService} from "../../../services/member/member-login.service";
import {CommitteeReferenceData} from "../../../services/committee/committee-reference-data";
import {CommitteeConfig, RoleType} from "../../../models/committee.model";
import {ComposerRoleDefaults, MailMessagingConfig, NotificationConfig} from "../../../models/mail.model";

describe("current-user sender and sign-off defaults", () => {
  const committee = {
    roles: [
      {type: "chair", memberId: "member-chair", fullName: "Sam Taylor", email: "chair@group.example.org.uk", roleType: RoleType.COMMITTEE_MEMBER},
      {type: "support", memberId: "member-current", fullName: "Alex Reed", email: "support@group.example.org.uk", roleType: RoleType.COMMITTEE_MEMBER}
    ],
    fileTypes: [],
    expenses: null
  } as CommitteeConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [{provide: MemberLoginService, useValue: {loggedInMember: () => ({memberId: "member-current", firstName: "Alex", lastName: "Reed"})}}]
    });
  });

  function component(mode: ComposerRoleDefaults): SenderRepliesAndSignoff {
    const instance = TestBed.runInInjectionContext(() => new SenderRepliesAndSignoff());
    instance.mailMessagingConfig = {committeeReferenceData: CommitteeReferenceData.create(committee, null)} as unknown as MailMessagingConfig;
    instance.notificationConfig = {senderRole: "chair", signOffRoles: ["chair"], composerRoleDefaults: mode} as NotificationConfig;
    instance.signOffRolesOverride = ["chair"];
    instance.allowSelectAllAsMeValue = true;
    instance.ngOnChanges({notificationConfig: new SimpleChange(null, instance.notificationConfig, true)});
    return instance;
  }

  it("applies the current user's sign-off after all inputs have been assigned", () => {
    const instance = component(ComposerRoleDefaults.CURRENT_USER);
    expect(instance.notificationConfig.senderRole).toBe("support");
    expect(instance.signOffRolesOverride).toEqual(["support"]);
    expect(instance.notificationConfig.signOffRoles).toEqual(["chair"]);
  });

  it("preserves the saved sign-off when the email type defaults are selected", () => {
    const instance = component(ComposerRoleDefaults.EMAIL_TYPE);
    expect(instance.signOffRolesOverride).toEqual(["chair"]);
  });

  it("preserves a sign-off edited after the initial defaults", () => {
    const instance = component(ComposerRoleDefaults.CURRENT_USER);
    instance.signOffRolesOverride = ["chair"];
    instance.ngOnChanges({signOffRolesOverride: new SimpleChange(["support"], ["chair"], false)});
    expect(instance.signOffRolesOverride).toEqual(["chair"]);
  });
});

describe("fix all invalid email roles", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [{provide: MemberLoginService, useValue: {loggedInMember: () => null}}]
    });
  });

  function instance(): SenderRepliesAndSignoff {
    const component = TestBed.runInInjectionContext(() => new SenderRepliesAndSignoff());
    const committee = {
      roles: [
        {type: "support-nick-barrett", description: "Support", fullName: "Nick Barrett", email: "support-nick-barrett@pvramblers.org.uk", roleType: RoleType.COMMITTEE_MEMBER},
        {type: "webmaster", description: "Webmaster", fullName: "Tom Gamble", email: "webmaster@pvramblers.org.uk", roleType: RoleType.COMMITTEE_MEMBER}
      ],
      fileTypes: [],
      expenses: null
    } as CommitteeConfig;
    component.mailMessagingConfig = {committeeReferenceData: CommitteeReferenceData.create(committee, null)} as unknown as MailMessagingConfig;
    component.notificationConfig = {
      senderRole: "support",
      replyToRole: "support",
      signOffRoles: ["support", "webmaster"],
      bccRoles: ["support", "webmaster"],
      ccRoles: ["retired"]
    } as NotificationConfig;
    return component;
  }

  it("repairs every stored role that is no longer on the committee", () => {
    const component = instance();
    expect(component.hasFixableRoleSettings()).toBe(true);
    component.fixAllInvalidRoles();
    expect(component.notificationConfig.senderRole).toBe("support-nick-barrett");
    expect(component.notificationConfig.replyToRole).toBe("");
    expect(component.notificationConfig.signOffRoles).toEqual(["support-nick-barrett", "webmaster"]);
    expect(component.notificationConfig.bccRoles).toEqual(["webmaster"]);
    expect(component.notificationConfig.ccRoles).toEqual([]);
    expect(component.hasFixableRoleSettings()).toBe(false);
  });

  it("selects the sender when no sign-off role is saved", () => {
    const component = instance();
    component.notificationConfig.signOffRoles = [];
    component.notificationConfig.replyToRole = "";
    component.notificationConfig.bccRoles = [];
    component.notificationConfig.ccRoles = [];
    component.fixAllInvalidRoles();
    expect(component.notificationConfig.senderRole).toBe("support-nick-barrett");
    expect(component.notificationConfig.signOffRoles).toEqual(["support-nick-barrett"]);
  });
});
