export function smtpSubmissionPort(): number {
  if (process.env.SMTP_SUBMISSION_PORT) {
    return +process.env.SMTP_SUBMISSION_PORT;
  } else {
    return 1587;
  }
}

export function imapListenPort(): number {
  if (process.env.IMAP_PORT) {
    return +process.env.IMAP_PORT;
  } else {
    return 1993;
  }
}
