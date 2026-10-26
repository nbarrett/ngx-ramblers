export const NOTIFICATION_SUBJECT_AFFIX_DELIMITER = " – ";

const EM_DASH_DELIMITER = " — ";
const EN_DASH_DELIMITER = " – ";
const HYPHEN_DELIMITER = " - ";

export function notificationSubjectAffixDelimiter(subjectText?: string | null): string {
  const text = subjectText ?? "";
  if (text.includes("—")) {
    return EM_DASH_DELIMITER;
  } else if (text.includes("–")) {
    return EN_DASH_DELIMITER;
  } else if (text.includes(HYPHEN_DELIMITER)) {
    return HYPHEN_DELIMITER;
  } else {
    return EN_DASH_DELIMITER;
  }
}

export function joinNotificationSubject(parts: (string | null | undefined)[]): string {
  const present = parts.filter(part => !!part);
  return present.join(notificationSubjectAffixDelimiter(present.join(" ")));
}
