import { describe, expect, it } from "vitest";
import { MailConfig, NotificationConfig } from "../models/mail.model";
import { notificationConfigVisible, visibleNotificationConfigs } from "./notification-config-visibility";

function config(text: string, id?: string): NotificationConfig {
  return {subject: {text}, id} as NotificationConfig;
}

describe("notification-config-visibility", () => {
  const mailConfig = {
    registrationConfirmationConfigId: "reg-confirm",
    volunteerNotificationConfigId: "vol-1"
  } as MailConfig;

  it("hides registration configs unless platform admin is enabled", () => {
    expect(notificationConfigVisible(config("Confirm your NGX registration"), mailConfig, {
      platformMailConfigsVisible: false,
      volunteerManagementEnabled: false
    })).toEqual(false);
    expect(notificationConfigVisible(config("Confirm your NGX registration", "reg-confirm"), mailConfig, {
      platformMailConfigsVisible: true,
      volunteerManagementEnabled: false
    })).toEqual(true);
  });

  it("hides volunteer configs unless volunteer management is enabled", () => {
    expect(notificationConfigVisible(config("Rights of Way Volunteer Correspondence", "vol-1"), mailConfig, {
      platformMailConfigsVisible: false,
      volunteerManagementEnabled: false
    })).toEqual(false);
    expect(notificationConfigVisible(config("Walk Change Notification"), mailConfig, {
      platformMailConfigsVisible: false,
      volunteerManagementEnabled: false
    })).toEqual(true);
  });

  it("filters a list to the configs that belong on that group", () => {
    const configs = [
      config("Walk Change Notification", "walk-1"),
      config("Confirm your NGX registration", "reg-confirm"),
      config("Rights of Way Volunteer Correspondence", "vol-1")
    ];
    expect(visibleNotificationConfigs(configs, mailConfig, {
      platformMailConfigsVisible: false,
      volunteerManagementEnabled: false
    }).map(item => item.id)).toEqual(["walk-1"]);
  });
});
