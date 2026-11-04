import { MailClientConnectionSettings } from "../models/mail-client.model";
import { mailClientSetupCopyText } from "./mail-client-connection";

const connection: MailClientConnectionSettings = {
  enabled: true,
  host: "mail.group.example.org.uk",
  imapPort: 993,
  smtpPort: 465,
  imapSecure: true,
  smtpSecure: true,
  usernameHint: "chair@group.example.org.uk",
  allowedFromAddresses: ["chair@group.example.org.uk", "secretary@group.example.org.uk"]
};

describe("mailClientSetupCopyText", () => {
  it("copies the selected address and both servers as labelled lines", () => {
    expect(mailClientSetupCopyText(connection, "secretary@group.example.org.uk", null, false)).toBe([
      "Email address: secretary@group.example.org.uk",
      "Password: none created yet",
      "",
      "Incoming mail (IMAP)",
      "Hostname: mail.group.example.org.uk",
      "Port: 993",
      "Username: secretary@group.example.org.uk",
      "Connection security: SSL/TLS",
      "",
      "Outgoing mail (SMTP)",
      "Hostname: mail.group.example.org.uk",
      "Port: 465",
      "Username: secretary@group.example.org.uk",
      "Connection security: SSL/TLS"
    ].join("\n"));
  });

  it("includes a generated application password after the email address", () => {
    expect(mailClientSetupCopyText(connection, "chair@group.example.org.uk", "app-password-example", true)).toContain("Password: app-password-example");
  });

  it("says already created passwords cannot be shown again", () => {
    expect(mailClientSetupCopyText(connection, "chair@group.example.org.uk", null, true)).toContain("Password: already created, cannot be shown again");
  });
});
