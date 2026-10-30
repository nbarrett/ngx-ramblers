import { MAIL_CLIENT_LOCAL_IMAP_PORT, MAIL_CLIENT_LOCAL_SMTP_PORT } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";

export function smtpSubmissionPort(): number {
  if (process.env.SMTP_SUBMISSION_PORT) {
    return +process.env.SMTP_SUBMISSION_PORT;
  } else {
    return MAIL_CLIENT_LOCAL_SMTP_PORT;
  }
}

export function imapListenPort(): number {
  if (process.env.IMAP_PORT) {
    return +process.env.IMAP_PORT;
  } else {
    return MAIL_CLIENT_LOCAL_IMAP_PORT;
  }
}
