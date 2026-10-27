import { dateTimeNow } from "../shared/dates";
import { MAIL_CLIENT_MAX_SENDS_PER_HOUR } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";

const sendTimesByMember = new Map<string, number[]>();

export function recordMailClientSend(memberId: string): void {
  const now = dateTimeNow().toMillis();
  const windowStart = now - 60 * 60 * 1000;
  const previous = (sendTimesByMember.get(memberId) ?? []).filter(time => time >= windowStart);
  sendTimesByMember.set(memberId, previous.concat(now));
}

export function mailClientSendAllowed(memberId: string): boolean {
  const now = dateTimeNow().toMillis();
  const windowStart = now - 60 * 60 * 1000;
  const previous = (sendTimesByMember.get(memberId) ?? []).filter(time => time >= windowStart);
  sendTimesByMember.set(memberId, previous);
  return previous.length < MAIL_CLIENT_MAX_SENDS_PER_HOUR;
}

export function resetMailClientRateLimits(): void {
  sendTimesByMember.clear();
}
