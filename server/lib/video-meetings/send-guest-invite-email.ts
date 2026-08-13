import { Brevo } from "@getbrevo/brevo";
import { brevoClient, configuredBrevo } from "../brevo/brevo-config";
import { scheduleBrevo } from "../brevo/common/rate-limiting";
import { systemConfig } from "../config/system-config";
import { MailProvider } from "../../../projects/ngx-ramblers/src/app/models/system.model";

export async function sendGuestInviteEmail(toEmail: string, toName: string, subject: string, html: string): Promise<boolean> {
  const system = await systemConfig();
  const brevo = await configuredBrevo();
  const available = system?.mailDefaults?.mailProvider === MailProvider.BREVO && !!brevo?.apiKey;
  if (available) {
    const client = await brevoClient();
    const email: Brevo.SendTransacEmailRequest = {
      subject,
      sender: {email: "backup@ngx-ramblers.org.uk", name: system?.group?.longName || "Ramblers"},
      to: [{email: toEmail, name: toName || toEmail}],
      htmlContent: html
    };
    await scheduleBrevo(() => client.transactionalEmails.sendTransacEmail(email));
    return true;
  } else {
    return false;
  }
}
