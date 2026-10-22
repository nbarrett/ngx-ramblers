import { describe, expect, it } from "vitest";
import { MailNotificationTemplateEditor } from "./mail-notification-template-editor";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { EMAIL_COMPOSER_BODY_PLACEHOLDER, MailConfig, MISSING_EMAIL_CONTENT_ISSUE, NotificationConfig } from "../../../../models/mail.model";

describe("email configuration content validation", () => {
  const config: NotificationConfig = {id: "member-sync-config", bannerId: "banner-one", senderRole: "membership", signOffRoles: ["membership"]} as NotificationConfig;

  function issues(target: NotificationConfig, mappedId: string = "member-sync-config") {
    const context = {
      notificationConfig: config,
      mailMessagingConfig: {mailConfig: {memberSyncNotificationConfigId: mappedId} as MailConfig},
      mailMessagingService: {workflowIdsFor: MailMessagingService.prototype.workflowIdsFor}
    };
    return MailNotificationTemplateEditor.prototype.configIssues.call(context, target);
  }

  it("accepts an empty body and no template when a built-in process supplies content", () => {
    expect(issues(config)).toEqual([]);
  });

  it("requires content for an ordinary email configuration", () => {
    expect(issues({...config, id: "ordinary-config"})).toContain(MISSING_EMAIL_CONTENT_ISSUE);
  });

  it("checks the configuration being labelled rather than the selected built-in configuration", () => {
    expect(issues({...config, id: "other-config"}, "other-config")).toEqual([]);
    expect(issues(config, "other-config")).toContain(MISSING_EMAIL_CONTENT_ISSUE);
  });

  it("still reports missing delivery settings for a built-in process", () => {
    expect(issues({...config, bannerId: null, senderRole: null, signOffRoles: []})).toEqual([
      "No banner image selected", "No sender role configured - emails cannot be sent", "No sign-off roles selected"
    ]);
  });

  it("continues accepting templates, written content and composer content for ordinary emails", () => {
    const ordinary = {...config, id: "ordinary-config"};
    expect(issues({...ordinary, templateName: "example-template"})).toEqual([]);
    expect(issues({...ordinary, body: "Hello Alex"})).toEqual([]);
    expect(issues({...ordinary, body: EMAIL_COMPOSER_BODY_PLACEHOLDER})).toEqual([]);
  });
});
