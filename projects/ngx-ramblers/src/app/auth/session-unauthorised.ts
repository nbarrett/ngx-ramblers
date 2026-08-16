import { isObject, isString } from "es-toolkit/compat";

const OUR_SESSION_MESSAGES = [
  "authentication required",
  "token expired or invalid",
  "unauthorized"
];

function textLooksLikeOurSession(value: string): boolean {
  return OUR_SESSION_MESSAGES.includes(value.trim().toLowerCase());
}

export function isOurSessionUnauthorised(error: {error?: unknown}): boolean {
  const body = error?.error;
  let ours = false;
  if (!body) {
    ours = true;
  } else if (isString(body)) {
    ours = body.trim().length === 0 || textLooksLikeOurSession(body);
  } else if (isObject(body)) {
    const record = body as Record<string, unknown>;
    const request = isObject(record.request) ? record.request as Record<string, unknown> : null;
    const messageType = request && isString(request.messageType) ? request.messageType : "";
    if (messageType.length > 0) {
      ours = false;
    } else {
      const message = isString(record.message) ? record.message : "";
      const errorField = isString(record.error) ? record.error : "";
      ours = textLooksLikeOurSession(message) || textLooksLikeOurSession(errorField);
    }
  } else {
    ours = false;
  }
  return ours;
}
