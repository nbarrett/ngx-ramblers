export function mapBrevoContactFields<T extends object>(contact: T): T & {
  emailDenied: boolean;
  smsDenied: boolean;
} {
  const source = contact as T & {
    emailBlacklisted?: boolean;
    emailDenied?: boolean;
    smsBlacklisted?: boolean;
    smsDenied?: boolean;
  };
  const emailDenied = !!source.emailDenied || !!source.emailBlacklisted;
  const smsDenied = !!source.smsDenied || !!source.smsBlacklisted;
  return {
    ...contact,
    emailDenied,
    smsDenied,
    emailBlacklisted: undefined,
    smsBlacklisted: undefined
  } as T & {emailDenied: boolean; smsDenied: boolean};
}

export function mapBrevoListFields<T extends object>(list: T): T & {totalDenied: number} {
  const source = list as T & {totalDenied?: number; totalBlacklisted?: number};
  const totalDenied = Number(source.totalDenied ?? source.totalBlacklisted ?? 0);
  return {
    ...list,
    totalDenied,
    totalBlacklisted: undefined
  } as T & {totalDenied: number};
}

export function mapBrevoContacts<T extends object>(contacts: T[]): Array<T & {emailDenied: boolean; smsDenied: boolean}> {
  return (contacts || []).map(contact => mapBrevoContactFields(contact));
}

export function mapBrevoLists<T extends object>(lists: T[]): Array<T & {totalDenied: number}> {
  return (lists || []).map(list => mapBrevoListFields(list));
}

export function toBrevoContactUpdateFields(fields: {
  emailDenied?: boolean;
  smsDenied?: boolean;
  smtpDeniedSenders?: string[];
}): {
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  smtpBlacklistSender?: string[];
} {
  return {
    ...(fields.emailDenied !== undefined ? {emailBlacklisted: fields.emailDenied} : {}),
    ...(fields.smsDenied !== undefined ? {smsBlacklisted: fields.smsDenied} : {}),
    ...(fields.smtpDeniedSenders !== undefined ? {smtpBlacklistSender: fields.smtpDeniedSenders} : {})
  };
}
