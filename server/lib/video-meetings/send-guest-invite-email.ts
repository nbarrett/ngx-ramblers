import { Brevo } from "@getbrevo/brevo";
import { brevoClient, configuredBrevo } from "../brevo/brevo-config";
import { scheduleBrevo } from "../brevo/common/rate-limiting";
import { systemConfig } from "../config/system-config";
import { MailProvider } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { EmailAddress } from "../../../projects/ngx-ramblers/src/app/models/mail.model";

async function sendExternalGuestInviteEmail(sender: EmailAddress, toEmail: string, toName: string, subject: string, html: string): Promise<boolean> {
  const system = await systemConfig();
  const brevo = await configuredBrevo();
  const available = system?.mailDefaults?.mailProvider === MailProvider.BREVO && !!brevo?.apiKey && !!sender?.email;
  if (available) {
    const client = await brevoClient();
    const email: Brevo.SendTransacEmailRequest = {
      subject,
      sender: {email: sender.email, name: sender.name || system?.group?.longName || "Ramblers"},
      replyTo: {email: sender.email, name: sender.name || system?.group?.longName || "Ramblers"},
      to: [{email: toEmail, name: toName || toEmail}],
      htmlContent: html
    };
    await scheduleBrevo(() => client.transactionalEmails.sendTransacEmail(email));
    return true;
  } else {
    return false;
  }
}

export async function sendGuestInviteEmail(sender: EmailAddress, toEmail: string, toName: string, subject: string, html: string): Promise<boolean> {
  return sendExternalGuestInviteEmail(sender, toEmail, toName, subject, html);
}
